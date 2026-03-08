
# Project: Asiacuisine.re Website

## Project Overview

This is the official website for Asiacuisine.re, a culinary service offering private chef services, cooking classes, and meal orders in La Réunion. The project is a static-first website enhanced with Cloudflare Pages Functions and Workers for dynamic features like reservations and contact forms.

The frontend is built with HTML, CSS, and vanilla JavaScript. It uses i18next for internationalization (FR, EN, ZH) and Swiper.js for carousels.

The backend consists of several functions responsible for:
-   **Reservations (`/functions/reserver.js`):** Handles booking requests, saves them to a Supabase `bookings` table, and sends email notifications using Resend.
-   **Service/Menu Requests (`/functions/create-request.js`):** Manages more complex requests (like menu orders), storing data in Supabase `clients` and `demandes` tables, and also sending Resend emails.
-   **Availability (`/functions/disponibilites.js`):** Provides a list of unavailable dates for the booking calendar by querying the Supabase database.
-   **Document Generation (`/functions/generate-document.js`):** Creates PDF invoices and quotes using `pdf-lib` based on requests stored in the database.
-   **QR Code Generation (`/functions/generate-qrcode.js`):** Generates QR codes that link to a tracking page for orders/requests.

There is also a separate admin section (likely at `gestion.asiacuisine.re`) that uses API endpoints under `/api/` to manage bookings (get, delete) protected by a simple password.

### Key Technologies

*   **Frontend:** HTML, CSS, Vanilla JavaScript
*   **Backend:** Node.js (Cloudflare Workers / Pages Functions)
*   **Database:** Supabase (PostgreSQL) is used for storing bookings, client data, and service requests.
*   **Email:** Resend for transactional emails (notifications).
*   **PDF Generation:** `pdf-lib` for creating documents.
*   **Internationalization:** `i18next`
*   **Hosting:** Cloudflare Pages.

## Building and Running

This project does not have a complex build process.

*   **Frontend:** To run the frontend, you can serve the files using a simple local web server. For example, using Python:
    ```bash
    python -m http.server
    ```
    Or using a tool like `live-server` for automatic reloading.

*   **Backend:** The functions are intended to be run on Cloudflare. To run them locally, you would need to use Wrangler:
    ```bash
    wrangler pages dev .
    ```

### Environment Variables

The backend functions require environment variables to be set up. These are configured in the Cloudflare Dashboard. Based on the code, the required variables are:

*   `SUPABASE_URL`: The URL of the Supabase project.
*   `SUPABASE_KEY`: The public API key for Supabase.
*   `SUPABASE_SERVICE_ROLE_KEY`: The service role key for Supabase (for admin-level operations).
*   `RESEND_API_KEY`: The API key for Resend.
*   `ADMIN_PASSWORD`: a password for the admin api.


## Development Conventions

*   **Code Style:** The code seems to follow standard JavaScript conventions, using ES modules (`import`/`export`).
*   **Dependencies:** Frontend dependencies are loaded via CDN, while backend dependencies are managed with `package.json`.
*   **API:** The project exposes several API endpoints through serverless functions. They are well-structured and handle specific tasks. CORS headers on some functions suggest they are accessed from a different domain (the admin panel).
*   **Testing:** The `package.json` includes a "test" script that currently does nothing. There are no test files in the project.

