const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { query } = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, and image files are allowed.'), false);
    }
  }
});

// GET /documents (list documents)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, u.email as uploader_name 
      FROM documents d 
      LEFT JOIN users u ON d.uploaded_by = u.id 
      ORDER BY d.created_at DESC
    `);
    res.render('documents-table', { documents: result.rows, user: { email: req.session.userEmail } });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.render('documents-table', { documents: [], user: { email: req.session.userEmail } });
  }
});

// GET /upload
router.get('/upload', isAuthenticated, (req, res) => {
  res.render('upload');
});

// POST /upload
router.post('/upload', isAuthenticated, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'Please select a file to upload');
      return res.redirect('/documents/upload');
    }

    // Upload to Cloudinary using data URI
    const dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const cloudinaryResult = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'auto',
      folder: 'documents',
      public_id: `${Date.now()}-${req.file.originalname}`
    });

    let extractedData = {
      vendor: null,
      invoice_date: null,
      amount: null,
      vat: null,
      invoice_number: null
    };

    // Try to extract data using Google Gemini
    try {
      const imageBase64 = req.file.buffer.toString('base64');
      const geminiPayload = {
        prompt: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract vendor, invoice_date (YYYY-MM-DD), amount, vat, invoice_number from this invoice image. Return only valid JSON with those keys and nothing else.'
                },
                {
                  type: 'image',
                  image: imageBase64
                }
              ]
            }
          ]
        }
      };

      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta2/models/gemini-1.5-flash:generateText?key=AIzaSyAdKo2KoXTw0dIJbv_oKpnjBSj8CnDreIk';
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(geminiPayload)
      });

      const responseText = await geminiResponse.text();
      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error ${geminiResponse.status}: ${responseText}`);
      }
      if (!responseText) {
        throw new Error('Gemini API returned an empty response body');
      }

      let geminiResult;
      try {
        geminiResult = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Gemini response was not valid JSON: ${responseText}`);
      }

      const aiOutput = (() => {
        if (typeof geminiResult?.output?.text === 'string') {
          return geminiResult.output.text;
        }
        if (Array.isArray(geminiResult?.output?.text)) {
          return geminiResult.output.text.join(' ');
        }
        if (Array.isArray(geminiResult?.candidates)) {
          const first = geminiResult.candidates[0];
          const content = first?.content || first?.message?.content;
          if (typeof content === 'string') return content;
          if (Array.isArray(content)) return content.map(part => part?.text || '').join(' ');
        }
        if (typeof geminiResult?.output?.[0]?.content === 'string') {
          return geminiResult.output[0].content;
        }
        return JSON.stringify(geminiResult);
      })();

      extractedData = JSON.parse(aiOutput);
    } catch (aiError) {
      console.error('AI extraction error:', aiError);
      req.flash('error', 'Document uploaded but AI extraction failed. Please update details manually.');
    }

    // Check for duplicate documents
    try {
      // Check for duplicate filename first (basic duplicate detection)
      const duplicateFileResult = await query(
        'SELECT id FROM documents WHERE filename = $1',
        [req.file.originalname]
      );
      
      if (duplicateFileResult.rows.length > 0) {
        req.flash('error', 'Duplicate document detected: File with same name already exists.');
        return res.redirect('/documents/upload');
      }
      
      // Check for duplicate invoice number (if extracted)
      if (extractedData.invoice_number) {
        const duplicateInvoiceResult = await query(
          'SELECT id FROM documents WHERE invoice_number = $1',
          [extractedData.invoice_number]
        );
        
        if (duplicateInvoiceResult.rows.length > 0) {
          req.flash('error', 'Duplicate document detected: Invoice number already exists.');
          return res.redirect('/documents/upload');
        }
      }
      
      // Check for duplicate vendor and amount (within 0.01)
      if (extractedData.vendor && extractedData.amount) {
        const duplicateVendorAmountResult = await query(
          'SELECT id FROM documents WHERE vendor = $1 AND ABS(amount - $2) <= 0.01',
          [extractedData.vendor, parseFloat(extractedData.amount)]
        );
        
        if (duplicateVendorAmountResult.rows.length > 0) {
          req.flash('error', 'Duplicate document detected: Document with same vendor and amount already exists.');
          return res.redirect('/documents/upload');
        }
      }
      
      console.log('Extracted data:', extractedData);
      
    } catch (duplicateError) {
      console.error('Duplicate check error:', duplicateError);
      // Continue with upload if duplicate check fails
    }

    // Save to database with extracted data
    await query(
      `INSERT INTO documents (filename, cloudinary_url, uploaded_by, vendor, invoice_date, amount, vat, invoice_number) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.file.originalname,
        cloudinaryResult.secure_url,
        req.session.userId,
        extractedData.vendor || null,
        extractedData.invoice_date || null,
        extractedData.amount ? parseFloat(extractedData.amount) : null,
        extractedData.vat ? parseFloat(extractedData.vat) : null,
        extractedData.invoice_number || null
      ]
    );

    req.flash('success', 'Document uploaded successfully! Data extracted using AI.');
    res.redirect('/documents');
  } catch (error) {
    console.error('Upload error:', error);
    req.flash('error', 'Failed to upload file. Please try again.');
    res.redirect('/documents/upload');
  }
});

// DELETE /documents/:id
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const documentId = req.params.id;
    
    // Get document info
    const docResult = await query(
      'SELECT * FROM documents WHERE id = $1 AND uploaded_by = $2',
      [documentId, req.session.userId]
    );
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = docResult.rows[0];
    
    // Extract public_id from Cloudinary URL
    const urlParts = document.cloudinary_url.split('/');
    const filenameWithExt = urlParts[urlParts.length - 1];
    const publicId = `documents/${filenameWithExt.split('.')[0]}`;
    
    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);
    
    // Delete from database
    await query('DELETE FROM documents WHERE id = $1', [documentId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// POST /documents/:id/approve
router.post('/:id/approve', isAuthenticated, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userRole = req.session.userRole;
    
    // Get document info
    const docResult = await query('SELECT * FROM documents WHERE id = $1', [documentId]);
    
    if (docResult.rows.length === 0) {
      req.flash('error', 'Document not found');
      return res.redirect('/documents');
    }
    
    const document = docResult.rows[0];
    const currentStep = document.approval_step || 1;
    
    // Check if user can approve at this step
    let canApprove = false;
    
    if (userRole === 'admin') {
      canApprove = true;
    } else if (userRole === 'reviewer' && currentStep === 1) {
      canApprove = true;
    } else if (userRole === 'manager' && currentStep === 2) {
      canApprove = true;
    } else if (userRole === 'finance' && currentStep === 3) {
      canApprove = true;
    }
    
    if (!canApprove) {
      req.flash('error', 'You do not have permission to approve this document at this step');
      return res.redirect('/documents');
    }
    
    // Update approval step and status
    let newStep = currentStep + 1;
    let newStatus = 'pending';
    
    if (newStep > 3) {
      newStatus = 'approved';
      newStep = 3;
    }
    
    await query(
      'UPDATE documents SET approval_step = $1, status = $2 WHERE id = $3',
      [newStep, newStatus, documentId]
    );
    
    req.flash('success', 'Document approved successfully');
    res.redirect('/documents');
    
  } catch (error) {
    console.error('Approval error:', error);
    req.flash('error', 'Failed to approve document');
    res.redirect('/documents');
  }
});

// POST /documents/:id/reject
router.post('/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userRole = req.session.userRole;
    
    // Get document info
    const docResult = await query('SELECT * FROM documents WHERE id = $1', [documentId]);
    
    if (docResult.rows.length === 0) {
      req.flash('error', 'Document not found');
      return res.redirect('/documents');
    }
    
    const document = docResult.rows[0];
    const currentStep = document.approval_step || 1;
    
    // Check if user can reject at this step
    let canReject = false;
    
    if (userRole === 'admin') {
      canReject = true;
    } else if (userRole === 'reviewer' && currentStep === 1) {
      canReject = true;
    } else if (userRole === 'manager' && currentStep === 2) {
      canReject = true;
    } else if (userRole === 'finance' && currentStep === 3) {
      canReject = true;
    }
    
    if (!canReject) {
      req.flash('error', 'You do not have permission to reject this document at this step');
      return res.redirect('/documents');
    }
    
    await query(
      'UPDATE documents SET status = $1, approval_step = 1 WHERE id = $2',
      ['rejected', documentId]
    );
    
    req.flash('success', 'Document rejected successfully');
    res.redirect('/documents');
    
  } catch (error) {
    console.error('Rejection error:', error);
    req.flash('error', 'Failed to reject document');
    res.redirect('/documents');
  }
});

// Helper: build report filter SQL
function buildReportQuery(filters) {
  const { startDate, endDate, vendor, status, minAmount, maxAmount } = filters;
  let sql = `
    SELECT d.*, u.email as uploader_name 
    FROM documents d 
    LEFT JOIN users u ON d.uploaded_by = u.id 
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    sql += ` AND d.created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    sql += ` AND d.created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (vendor) {
    sql += ` AND d.vendor ILIKE $${paramIndex}`;
    params.push(`%${vendor}%`);
    paramIndex++;
  }

  if (status) {
    sql += ` AND d.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (minAmount) {
    sql += ` AND d.amount >= $${paramIndex}`;
    params.push(parseFloat(minAmount));
    paramIndex++;
  }

  if (maxAmount) {
    sql += ` AND d.amount <= $${paramIndex}`;
    params.push(parseFloat(maxAmount));
    paramIndex++;
  }

  sql += ' ORDER BY d.created_at DESC';
  return { sql, params };
}

// GET /reports
router.get('/reports', isAuthenticated, async (req, res) => {
  try {
    const filters = req.query;
    const { sql, params } = buildReportQuery(filters);
    
    const result = await query(sql, params);
    
    res.render('reports', { 
      documents: result.rows, 
      filters: filters,
      userRole: req.session.userRole
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.render('reports', { 
      documents: [], 
      filters: {}, 
      userRole: req.session.userRole,
      error: 'Failed to load reports'
    });
  }
});

// GET /reports/insights
router.get('/reports/insights', isAuthenticated, async (req, res) => {
  try {
    const filters = req.query;
    const { sql, params } = buildReportQuery(filters);
    const data = await query(sql, params);
    const documents = data.rows;

    // Stats
    const amounts = documents
      .filter(d => d.amount !== null && d.amount !== undefined)
      .map(d => Number(d.amount));

    const totalSpend = amounts.reduce((sum, v) => sum + v, 0);
    const averageAmount = amounts.length ? totalSpend / amounts.length : 0;

    const variance = amounts.length
      ? amounts.reduce((sum, v) => sum + Math.pow(v - averageAmount, 2), 0) / amounts.length
      : 0;
    const stddev = Math.sqrt(variance);
    const unusualThreshold = averageAmount + 2 * stddev;

    const topVendorsMap = documents.reduce((acc, doc) => {
      const vendorName = doc.vendor || 'Unknown';
      acc[vendorName] = (acc[vendorName] || 0) + (Number(doc.amount) || 0);
      return acc;
    }, {});

    const topVendors = Object.entries(topVendorsMap)
      .map(([vendor, total]) => ({ vendor, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const unusualDocuments = documents
      .filter(doc => doc.amount !== null && doc.amount !== undefined && Number(doc.amount) > unusualThreshold)
      .map(doc => ({
        id: doc.id,
        filename: doc.filename,
        vendor: doc.vendor,
        amount: Number(doc.amount),
        status: doc.status,
        uploader_name: doc.uploader_name,
        created_at: doc.created_at
      }));

    const insightSummary = `Total spend is R${totalSpend.toFixed(2)} across ${documents.length} documents. Top vendor: ${topVendors[0] ? topVendors[0].vendor : 'N/A'}. Average amount is R${averageAmount.toFixed(2)} with ${unusualDocuments.length} outliers above 2σ.`;

    return res.json({
      totalSpend,
      averageAmount,
      documentCount: documents.length,
      stddev,
      unusualThreshold,
      topVendors,
      unusualDocuments,
      summary: insightSummary
    });
  } catch (error) {
    console.error('Insights error:', error);
    return res.status(500).json({ error: 'Failed to compute insights' });
  }
});

// GET /reports/export/excel
router.get('/reports/export/excel', isAuthenticated, async (req, res) => {
  try {
    const filters = req.query;
    const { sql, params } = buildReportQuery(filters);
    const result = await query(sql, params);
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Documents Report');
    
    // Add headers
    worksheet.columns = [
      { header: 'Filename', key: 'filename', width: 30 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Approval Step', key: 'approval_step', width: 15 },
      { header: 'Uploaded By', key: 'uploader_name', width: 25 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];
    
    // Add data
    worksheet.addRows(result.rows);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=documents-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    // Send file
    await workbook.xlsx.write(res);
    
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).send('Failed to export Excel file');
  }
});

// GET /reports/export/pdf
router.get('/reports/export/pdf', isAuthenticated, async (req, res) => {
  try {
    const filters = req.query;
    const { sql, params } = buildReportQuery(filters);
    const result = await query(sql, params);
    
    // Create PDF document
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=documents-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content
    doc.fontSize(20).text('Documents Report', { align: 'center' });
    doc.moveDown();
    
    // Add filters info
    doc.fontSize(12).text('Filters Applied:');
    if (startDate) doc.text(`Start Date: ${startDate}`);
    if (endDate) doc.text(`End Date: ${endDate}`);
    if (vendor) doc.text(`Vendor: ${vendor}`);
    if (status) doc.text(`Status: ${status}`);
    if (minAmount) doc.text(`Min Amount: $${minAmount}`);
    if (maxAmount) doc.text(`Max Amount: $${maxAmount}`);
    
    doc.moveDown();
    
    // Add table headers
    doc.fontSize(10).text('Filename | Vendor | Amount | Status | Uploaded By | Date');
    doc.text('---------|--------|--------|--------|-------------|------------');
    
    // Add data rows
    result.rows.forEach(doc => {
      const row = `${doc.filename.substring(0, 15)} | ${doc.vendor || 'N/A'} | $${doc.amount || '0'} | ${doc.status} | ${doc.uploader_name} | ${new Date(doc.created_at).toLocaleDateString()}`;
      doc.text(row);
    });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).send('Failed to export PDF file');
  }
});

module.exports = router;
