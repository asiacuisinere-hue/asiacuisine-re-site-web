import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Génère un PDF de devis
 * @param quote - L'objet devis de la base de données
 * @param customer - Client ou entreprise
 * @param items - Lignes du devis
 * @param total - Montant total
 */
export async function generateQuotePDF(quote: any, customer: any, items: any[], total: number): Promise<Uint8Array> {
    // Récupérer les paramètres de l'entreprise
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

    if (!companySettings) {
        throw new Error('Paramètres de l\'entreprise non trouvés');
    }

    // Créer le document PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // Format A4
    const { height } = page.getSize();
    
    // Charger les polices
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Définir les couleurs
    const gold = rgb(0.83, 0.69, 0.22);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.95, 0.95, 0.95);
    const white = rgb(1, 1, 1);
    
    let y = height - 50;
    let textStartX = 50;

    // === EN-TÊTE AVEC LOGO ===
    try {
        if (companySettings.logo_url) {
            const logoResponse = await fetch(companySettings.logo_url);
            if (logoResponse.ok) {
                const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
                const logoImage = companySettings.logo_url.toLowerCase().includes('.png') 
                    ? await pdfDoc.embedPng(logoBytes) 
                    : await pdfDoc.embedJpg(logoBytes);
                const logoDims = logoImage.scale(65 / logoImage.height);
                page.drawImage(logoImage, { 
                    x: 50, 
                    y: y - logoDims.height + 20, 
                    width: logoDims.width, 
                    height: logoDims.height 
                });
                textStartX = 50 + logoDims.width + 15;
            }
        }
    } catch (e) {
        console.error('Logo non chargé:', e.message);
    }

    // Informations de l'entreprise
    page.drawText(companySettings.name || '', { 
        x: textStartX, y, size: 18, font: fontBold, color: gold 
    });
    y -= 18;
    page.drawText(companySettings.owner || '', { 
        x: textStartX, y, size: 9, font, color: black 
    });
    y -= 12;
    page.drawText(companySettings.address || '', { 
        x: textStartX, y, size: 9, font, color: gray 
    });
    y -= 12;
    page.drawText(companySettings.city || '', { 
        x: textStartX, y, size: 9, font, color: gray 
    });
    y -= 12;
    page.drawText(`Tél: ${companySettings.phone || ''} | ${companySettings.email || ''}`, { 
        x: textStartX, y, size: 9, font, color: gray 
    });
    y -= 12;
    page.drawText(`SIRET: ${companySettings.siret || ''}`, { 
        x: textStartX, y, size: 9, font: fontBold, color: black 
    });

    // Badge "DEVIS" en haut à droite
    page.drawRectangle({ 
        x: 440, y: height - 58, width: 105, height: 35, color: gold 
    });
    page.drawText('DEVIS', { 
        x: 462, y: height - 48, size: 18, font: fontBold, color: white 
    });

    // Numéro et date du devis (alignés à droite)
    let yRight = height - 95;
    const docNumberText = `N°: ${quote.document_number}`;
    page.drawText(docNumberText, { 
        x: 545 - fontBold.widthOfTextAtSize(docNumberText, 10), 
        y: yRight, size: 10, font: fontBold 
    });
    yRight -= 14;
    const dateText = `Date: ${new Date(quote.created_at || new Date()).toLocaleDateString('fr-FR')}`;
    page.drawText(dateText, { 
        x: 545 - font.widthOfTextAtSize(dateText, 9), 
        y: yRight, size: 9, font, color: gray 
    });
    yRight -= 14;
    const validityText = 'Validité: 30 jours';
    page.drawText(validityText, { 
        x: 545 - font.widthOfTextAtSize(validityText, 9), 
        y: yRight, size: 9, font, color: gray 
    });

    // Ligne de séparation
    y = height - 125;
    page.drawLine({ 
        start: { x: 50, y }, end: { x: 545, y }, thickness: 2, color: gold 
    });

    // === INFORMATIONS CLIENT ===
    y -= 30;
    page.drawRectangle({ 
        x: 320, y: y - 55, width: 225, height: 75, color: lightGray 
    });
    page.drawText('DESTINATAIRE', { 
        x: 330, y: y - 5, size: 10, font: fontBold, color: gold 
    });
    
    const customerName = customer.last_name 
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() 
        : (customer.nom_entreprise || 'Client');
    page.drawText(customerName, { 
        x: 330, y: y - 22, size: 11, font: fontBold, color: black 
    });
    
    const customerEmail = customer.email || customer.contact_email;
    if (customerEmail) {
        page.drawText(customerEmail, { 
            x: 330, y: y - 40, size: 9, font, color: gray 
        });
    }
    
    if (customer.phone) {
        page.drawText(customer.phone, { 
            x: 330, y: y - 52, size: 9, font, color: gray 
        });
    }

    // === TABLEAU DES SERVICES ===
    y = height - 250;
    
    // En-tête du tableau
    page.drawRectangle({ 
        x: 50, y: y, width: 495, height: 28, color: gold 
    });
    page.drawText('Description', { 
        x: 60, y: y + 10, size: 10, font: fontBold, color: white 
    });
    page.drawText('Qté', { 
        x: 340, y: y + 10, size: 10, font: fontBold, color: white 
    });
    page.drawText('Prix unit.', { 
        x: 400, y: y + 10, size: 10, font: fontBold, color: white 
    });
    page.drawText('Total', { 
        x: 490, y: y + 10, size: 10, font: fontBold, color: white 
    });
    
    y -= 10;

    // Lignes du devis
    if (items && Array.isArray(items)) {
        let rowIndex = 0;
        for (const item of items) {
            const rowColor = rowIndex % 2 === 0 ? white : lightGray;
            page.drawRectangle({ 
                x: 50, y: y - 25, width: 495, height: 25, color: rowColor 
            });
            
            // Description (tronquée si trop longue)
            const desc = (item.name || item.description || 'Service').substring(0, 45);
            page.drawText(desc, { 
                x: 60, y: y - 10, size: 10, font, color: black 
            });
            
            // Quantité
            page.drawText(String(item.quantity || 0), { 
                x: 350, y: y - 10, size: 10, font, color: black 
            });
            
            // Prix unitaire
            page.drawText(`${(item.price || 0).toFixed(2)} €`, { 
                x: 400, y: y - 10, size: 10, font, color: black 
            });
            
            // Total ligne
            const lineTotal = ((item.price || 0) * (item.quantity || 0)).toFixed(2);
            page.drawText(`${lineTotal} €`, { 
                x: 485, y: y - 10, size: 10, font, color: black 
            });
            
            y -= 25;
            rowIndex++;
            
            // Vérifier s\'il reste de la place
            if (y < 200) break;
        }
    }

    // === TOTAL ===
    y -= 20;
    page.drawRectangle({ 
        x: 350, y: y - 50, width: 195, height: 50, 
        color: rgb(0.98, 0.98, 0.98), 
        borderColor: gold, 
        borderWidth: 1 
    });
    
    page.drawText('TOTAL TTC:', { 
        x: 365, y: y - 15, size: 12, font: fontBold 
    });
    page.drawText(`${total.toFixed(2)} €`, { 
        x: 470, y: y - 15, size: 14, font: fontBold, color: gold 
    });

    // Message TVA
    y -= 60;
    page.drawText(companySettings.tva_message || 'TVA non applicable, art. 293 B du CGI', { 
        x: 50, y, size: 8, font, color: gray 
    });

    // === CONDITIONS ET NOTES ===
    y -= 30;
    page.drawText('Conditions de paiement:', { 
        x: 50, y, size: 9, font: fontBold, color: black 
    });
    y -= 13;
    page.drawText(companySettings.payment_conditions || 'Paiement à la commande', { 
        x: 50, y, size: 9, font, color: gray 
    });
    
    y -= 20;
    page.drawText('Moyens de paiement acceptés:', { 
        x: 50, y, size: 9, font: fontBold, color: black 
    });
    y -= 13;
    page.drawText(companySettings.payment_methods || 'Virement, Espèces, CB', { 
        x: 50, y, size: 9, font, color: gray 
    });

    // Informations bancaires (à droite)
    let yBank = y - 50;
    page.drawText('Pour les virements :', { 
        x: 300, y: yBank, size: 9, font: fontBold, color: black 
    });
    yBank -= 13;
    page.drawText('Établissement: 20041', { 
        x: 300, y: yBank, size: 9, font, color: gray 
    });
    yBank -= 13;
    page.drawText('Guichet: 01021', { 
        x: 300, y: yBank, size: 9, font, color: gray 
    });
    yBank -= 13;
    page.drawText('N° Compte: 0941814D018', { 
        x: 300, y: yBank, size: 9, font, color: gray 
    });
    yBank -= 13;
    page.drawText('Clé RIB: 29', { 
        x: 300, y: yBank, size: 9, font, color: gray 
    });
    yBank -= 13;
    page.drawText('Domiciliation: LA BANQUE POSTALE ST DENIS CENTRE FINANCIER', { 
        x: 300, y: yBank, size: 8, font, color: gray 
    });

    // === PIED DE PAGE ===
    page.drawLine({ 
        start: { x: 50, y: 45 }, end: { x: 545, y: 45 }, thickness: 1, color: gold 
    });
    
    const companyInfoString = `${companySettings.name || ''} | ${companySettings.owner || ''} | SIRET: ${companySettings.siret || ''} | ${companySettings.website || ''}`;
    const companyInfoWidth = font.widthOfTextAtSize(companyInfoString, 8);
    page.drawText(companyInfoString, {
        x: (page.getWidth() - companyInfoWidth) / 2,
        y: 30,
        size: 8,
        font,
        color: gray,
    });
    
    page.drawText('Merci de votre confiance !', { 
        x: 240, y: 18, size: 8, font: fontBold, color: gold 
    });

    // Sauvegarder et retourner le PDF
    return await pdfDoc.save();
}
