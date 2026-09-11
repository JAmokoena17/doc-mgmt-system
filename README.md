# AI Document Management System

A full-stack web application that automates financial document management and multi-stage approval workflows. It uses AI to extract invoice data, detects duplicates, and routes documents through a three-step approval process: Reviewer, then Manager, then Finance.

## Live Demo

You can access the live application at https://doc-mgmt-system-2h23.onrender.com. Because the app is hosted on Render's free tier, it may take up to a minute to wake up if it hasn't been accessed recently. Please be patient on the first load.

## Features

The system provides secure authentication with three distinct roles: Reviewer, Manager, and Finance. Users can upload invoices in image, PDF, or DOC format. The AI extraction automatically reads vendor, date, amount, VAT, and invoice number from the uploaded document. Duplicate invoices are detected and blocked. Documents must pass through a three-step approval workflow, and if any step is not completed, the status remains pending. The application also includes reporting and filtering capabilities so users can view documents by status, vendor, or date.

## Tech Stack

The backend is built with Node.js and Express, using PostgreSQL via Supabase for data storage. The frontend uses EJS templates and custom CSS. AI extraction is handled by OpenAI or Gemini depending on configuration. File uploads are stored on Cloudinary. Authentication is managed with sessions or JWT. The app is deployed on Render.

## How to Test

To test the application, start by registering a new user account on the live site. Once logged in, upload an invoice in image, PDF, or DOC format. The AI will attempt to extract the data. After uploading, log out of your account. Then log in using the pre-created test accounts to walk through the three-step approval process. Use reviewer@test.com first and approve the document. Then log out and log in as manager@test.com to approve it again. Finally, log out and log in as finance@test.com to give the final approval. The password for all three test accounts is 123. If any of the three approval steps is not completed, the document status will remain pending.

## Local Setup

If you want to run the project locally, clone the repository and run npm install to install dependencies. Create a .env file with your database, cloud storage, and AI keys. Then start the server with npm run dev and open http://localhost:3000 in your browser.

## Author

Junior Mokoena  
GitHub: https://github.com/JAmokoena17  
LinkedIn: https://linkedin.com/in/ja-mokoena-a6803b377

