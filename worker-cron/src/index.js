import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Embedded Translations (copied from fr.json, en.json, zh.json email sections)
const translations = {
    fr: {
        translation: {
            email: {
                confirmation: {
                    subject: "Confirmation de votre demande chez Asiacuisine.re",
                    title: "Merci pour votre demande !",
                    greeting: "Bonjour ${clientName},",
                    body: "Nous avons bien reçu votre demande (numéro de suivi : <strong>${requestId}</strong>) et nous vous en remercions. Nous l'examinerons attentivement et reviendrons vers vous dans les plus brefs délais (généralement sous 24h). Vous pouvez suivre l'état de votre demande à tout moment sur notre page de suivi : ${trackingPageUrl}.",
                    tracking_link_text: "cliquez ici",
                    summary_title: "Pour rappel, voici les informations que vous nous avez transmises :",
                    request_type: "Type de demande :",
                    request_date: "Date souhaitée :",
                    questions: "Si vous avez des questions, n'hésitez pas à nous contacter à contact@asiacuisine.re.",
                    closing: "Cordialement,",
                    signature: "L'équipe d'Asiacuisine.re"
                },
                reminder: {
                    subject: "Rappel de votre réservation chez Asiacuisine.re",
                    title: "Rappel amical de votre événement",
                    greeting: "Bonjour ${clientName},",
                    body: "Ceci est un simple rappel que votre prestation de chef à domicile est prévue pour le ${requestDate}. Nous sommes impatients de vous offrir une expérience culinaire mémorable.",
                    summary_title: "Résumé de votre réservation :",
                    request_type: "Type de service :",
                    questions: "Si vous avez la moindre question ou si des changements de dernière minute sont nécessaires, n'hésitez pas à nous contacter.",
                    closing: "À très bientôt,",
                    signature: "L'équipe d'Asiacuisine.re"
                },
                followup: {
                    subject: "Merci d'avoir choisi Asiacuisine.re !",
                    title: "Nous espérons que vous avez apprécié !",
                    greeting: "Bonjour ${clientName},",
                    body: "Nous tenions à vous remercier d'avoir fait appel à nos services pour votre événement du ${requestDate}. Nous espérons que l'expérience culinaire a été à la hauteur de vos attentes.",
                    feedback_prompt: "Votre avis est précieux pour nous aider à nous améliorer. Si vous avez un moment, nous serions ravis que vous partagiez votre expérience sur nos réseaux sociaux ou en répondant à cet e-mail.",
                    closing: "Au plaisir de vous régaler à nouveau,",
                    signature: "L'équipe d'Asiacuisine.re"
                },
                footer: {
                    tagline: "Chef privé, cours de cuisine et plats à emporter à La Réunion"
                }
            }
        }
    },
    en: {
        translation: {
            email: {
                confirmation: {
                    subject: "Confirmation of your request at Asiacuisine.re",
                    title: "Thank you for your request!",
                    greeting: "Hello ${clientName},",
                    body: "We have received your request (tracking number: <strong>${requestId}</strong>) and we thank you for it. We will review it carefully and get back to you as soon as possible (usually within 24 hours). You can track the status of your request at any time on our tracking page: ${trackingPageUrl}.",
                    tracking_link_text: "click here",
                    summary_title: "As a reminder, here is the information you provided:",
                    request_type: "Request type:",
                    request_date: "Desired date:",
                    questions: "If you have any questions, feel free to contact us at contact@asiacuisine.re.",
                    closing: "Best regards,",
                    signature: "The Asiacuisine.re Team"
                },
                reminder: {
                    subject: "Reminder for your Asiacuisine.re Booking",
                    title: "Friendly Reminder for Your Event",
                    greeting: "Hello ${clientName},",
                    body: "This is a friendly reminder that your private chef service is scheduled for ${requestDate}. We look forward to providing you with a memorable culinary experience.",
                    summary_title: "Summary of your booking:",
                    request_type: "Service type:",
                    questions: "If you have any questions or require last-minute changes, please do not hesitate to contact us.",
                    closing: "See you soon,",
                    signature: "The Asiacuisine.re Team"
                },
                followup: {
                    subject: "Thank you for choosing Asiacuisine.re!",
                    title: "We hope you enjoyed it!",
                    greeting: "Hello ${clientName},",
                    body: "We wanted to thank you for using our services for your event on ${requestDate}. We hope the culinary experience met your expectations.",
                    feedback_prompt: "Your feedback is valuable to help us improve. If you have a moment, we would be delighted if you could share your experience on our social media or by replying to this email.",
                    closing: "Looking forward to delighting you again,",
                    signature: "The Asiacuisine.re Team"
                },
                footer: {
                    tagline: "Private chef, cooking classes, and takeaway meals on Réunion Island"
                }
            }
        }
    },
    zh: {
        translation: {
            email: {
                confirmation: {
                    subject: "您的 Asiacuisine.re 请求已确认",
                    title: "感谢您的请求！",
                    greeting: "您好 ${clientName},",
                    body: "我们已收到您的请求（跟踪号：<strong>${requestId}</strong>），非常感谢。我们将仔细审核您的请求，并尽快（通常在24小时内）与您联系。您可以随时在我们的跟踪页面上查看您的请求状态：${trackingPageUrl}。",
                    tracking_link_text: "点击这里",
                    summary_title: "为了方便您核对，以下是您提交的信息：",
                    request_type: "请求类型：",
                    request_date: "期望日期：",
                    questions: "如果您有任何问题，请随时通过电子邮件 contact@asiacuisine.re 与我们联系。",
                    closing: "此致,",
                    signature: "Asiacuisine.re 团队"
                },
                reminder: {
                    subject: "您的 Asiacuisine.re 预订提醒",
                    title: "温馨提醒：您的活动即将开始",
                    greeting: "您好 ${clientName},",
                    body: "这封邮件是温馨提醒，您的私人厨师服务已安排在 ${requestDate}。我们期待为您带来难忘的美食体验。",
                    summary_title: "您的预订摘要：",
                    request_type: "服务类型：",
                    questions: "如果您有任何疑问或需要临时变更，请随时与我们联系。",
                    closing: "期待与您相见,",
                    signature: "Asiacuisine.re 团队"
                },
                footer: {
                    tagline: "留尼汪岛的私人厨师、烹饪课程和外卖美食"
                }
            }
        }
    }
};

const t = (lang, key) => {
    const keys = key.split('.');
    let result = translations[lang]?.translation;
    for (const k of keys) {
        result = result?.[k];
        if (!result) return key;
    }
    return result;
};

const getEmailFooter = (t_func, lang) => {
    const baseUrl = 'https://www.asiacuisine.re';
    const tagline = t_func(lang, 'email.footer.tagline');

    return `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; text-align: center; color: #888888; font-size: 12px;">
            <img src="${baseUrl}/favicon.png" alt="Asiacuisine.re Logo" width="50" height="50" style="margin-bottom: 10px;">
            <p style="margin: 0;"><strong>Asiacuisine.re</strong></p>
            <p style="margin: 0;">${tagline}</p>
            <p style="margin: 10px 0 0 0;">
                <a href="${baseUrl}?lang=${lang}" style="color: #888888; text-decoration: none;">Site Web</a> |
                <a href="https://www.instagram.com/asiacuisine.re/" style="color: #888888; text-decoration: none;">Instagram</a> |
                <a href="https://www.facebook.com/profile.php?id=100090025515349" style="color: #888888; text-decoration: none;">Facebook</a>
            </p>
        </div>
    `;
};

const formatDateToISOString = (date) => {
    return date.toISOString().split('T')[0];
};

export default {
    async scheduled(event, env, ctx) {
        console.log('--- [DEBUG] Scheduled tasks Worker triggered.');

        const resendApiKey = env.RESEND_API_KEY;
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        if (!resendApiKey || !supabase) {
            console.error('Environment variables for Resend or Supabase are not set for the Worker.');
            throw new Error('Critical environment variables missing for scheduled Worker.');
        }

        const resend = new Resend(resendApiKey);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // --- Task 1: Send Pre-Service Reminders (48h before) ---
        try {
            const twoDaysFromNow = new Date(today);
            twoDaysFromNow.setDate(today.getDate() + 2);
            const twoDaysFromNowISO = formatDateToISOString(twoDaysFromNow);

            const { data: reminderDemands, error: reminderError } = await supabase
                .from('demandes')
                .select('id, request_date, type, details_json, clients ( email, first_name, last_name ), entreprises ( contact_email, contact_name )')
                .eq('type', 'RESERVATION_SERVICE')
                .eq('status', 'confirmed')
                .eq('request_date', twoDaysFromNowISO)
                .is('reminder_sent', null);

            if (reminderError) throw reminderError;

            console.log(`Found ${reminderDemands.length} demands for reminders on ${twoDaysFromNowISO}`);

            for (const demand of reminderDemands) {
                const clientEmail = demand.clients?.email || demand.entreprises?.contact_email;
                const clientName = (demand.clients ? `${demand.clients.first_name || ''} ${demand.clients.last_name || ''}` : (demand.entreprises?.contact_name || '')).trim();
                const clientLang = demand.details_json?.lang || 'fr';
                const formattedRequestDate = new Date(demand.request_date).toLocaleDateString(clientLang === 'zh' ? 'zh-CN' : clientLang, { year: 'numeric', month: 'long', day: 'numeric' });

                if (!clientEmail) continue;

                const emailBody = `
                    <h2>${t(clientLang, 'email.reminder.title')}</h2>
                    <p>${t(clientLang, 'email.reminder.greeting').replace('${clientName}', clientName)}</p>
                    <p>${t(clientLang, 'email.reminder.body').replace('${requestDate}', `<strong>${formattedRequestDate}</strong>`)}</p>
                    <p><strong>${t(clientLang, 'email.reminder.summary_title')}</strong></p>
                    <ul>
                        <li><strong>${t(clientLang, 'email.reminder.request_type')}</strong> ${demand.details_json?.serviceType || demand.type}</li>
                    </ul>
                    <p>${t(clientLang, 'email.reminder.questions')}</p>
                    <br>
                    <p>${t(clientLang, 'email.reminder.closing')}</p>
                    <p><strong>${t(clientLang, 'email.reminder.signature')}</strong></p>
                `;

                await resend.emails.send({
                    from: 'Asiacuisine.re <no-reply@asiacuisine.re>',
                    to: clientEmail,
                    subject: t(clientLang, 'email.reminder.subject'),
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                            ${emailBody}
                            ${getEmailFooter(t, clientLang)}
                        </div>
                    `
                });

                await supabase.from('demandes').update({ reminder_sent: true }).eq('id', demand.id);
                console.log(`Reminder sent and marked for demand ID ${demand.id}`);
            }
        } catch (error) {
            console.error('Error processing pre-service reminders:', error);
        }

        // --- Task 2: Send Post-Service Follow-ups (1 day after) ---
        try {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayISO = formatDateToISOString(yesterday);

            const { data: followupDemands, error: followupError } = await supabase
                .from('demandes')
                .select('id, request_date, type, details_json, clients ( email, first_name, last_name ), entreprises ( contact_email, contact_name )')
                .eq('type', 'RESERVATION_SERVICE')
                .eq('status', 'completed')
                .eq('request_date', yesterdayISO)
                .is('followup_sent', null);

            if (followupError) throw followupError;

            console.log(`Found ${followupDemands.length} demands for follow-up on ${yesterdayISO}`);

            for (const demand of followupDemands) {
                const clientEmail = demand.clients?.email || demand.entreprises?.contact_email;
                const clientName = (demand.clients ? `${demand.clients.first_name || ''} ${demand.clients.last_name || ''}` : (demand.entreprises?.contact_name || '')).trim();
                const clientLang = demand.details_json?.lang || 'fr';
                const formattedRequestDate = new Date(demand.request_date).toLocaleDateString(clientLang === 'zh' ? 'zh-CN' : clientLang, { year: 'numeric', month: 'long', day: 'numeric' });

                if (!clientEmail) continue;

                const emailBody = `
                    <h2>${t(clientLang, 'email.followup.title')}</h2>
                    <p>${t(clientLang, 'email.reminder.greeting').replace('${clientName}', clientName)}</p>
                    <p>${t(clientLang, 'email.followup.body').replace('${requestDate}', `<strong>${formattedRequestDate}</strong>`)}</p>
                    <p>${t(clientLang, 'email.followup.feedback_prompt')}</p>
                    <br>
                    <p>${t(clientLang, 'email.followup.closing')}</p>
                    <p><strong>${t(clientLang, 'email.followup.signature')}</strong></p>
                `;

                await resend.emails.send({
                    from: 'Asiacuisine.re <no-reply@asiacuisine.re>',
                    to: clientEmail,
                    subject: t(clientLang, 'email.followup.subject'),
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                            ${emailBody}
                            ${getEmailFooter(t, clientLang)}
                        </div>
                    `
                });

                await supabase.from('demandes').update({ followup_sent: true }).eq('id', demand.id);
                console.log(`Follow-up sent and marked for demand ID ${demand.id}`);
            }
        } catch (error) {
            console.error('Error processing post-service follow-ups:', error);
        }

        console.log('Scheduled tasks Worker finished processing.');
    },
};