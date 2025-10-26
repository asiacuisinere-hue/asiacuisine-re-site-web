import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests allowed' });
    }

    const { password } = req.body;

    if (password === process.env.ADMIN_PASSWORD) {
        // In a real app, you'd issue a token (e.g., JWT)
        // For this simple case, we'll just confirm success.
        res.status(200).json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }
}
