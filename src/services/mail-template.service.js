function escapeHtml(value) {
  // Evita injecao de HTML quando variaveis dinamicas entram no template.
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailLayout({
  preheader = "",
  title = "",
  greeting = "",
  body = "",
  actionLabel = "",
  actionUrl = "",
  helperText = "",
  footerNote = "",
}) {
  const safePreheader = escapeHtml(preheader);
  const safeTitle = escapeHtml(title);
  const safeGreeting = escapeHtml(greeting);
  const safeBody = escapeHtml(body);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeHelperText = escapeHtml(helperText);
  const safeFooterNote = escapeHtml(footerNote);

  const buttonBlock = safeActionUrl
    ? `
      <tr>
        <td style="padding: 0 0 18px 0;">
          <a
            href="${safeActionUrl}"
            style="
              display: inline-block;
              background: #3b82f6;
              color: #0b1220;
              text-decoration: none;
              font-weight: 700;
              font-size: 14px;
              border-radius: 10px;
              padding: 12px 18px;
            "
            target="_blank"
            rel="noopener noreferrer"
          >${safeActionLabel}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 0 16px 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
          Se o botao nao funcionar, copie e cole este link no navegador:<br />
          <span style="word-break: break-all; color: #cbd5e1;">${safeActionUrl}</span>
        </td>
      </tr>
    `
    : "";

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MyFinance</title>
  </head>
  <body style="margin: 0; padding: 0; background: #0f172a;">
    <!-- Preheader oculto para melhorar previa em clientes de e-mail. -->
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
      ${safePreheader}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px;">
            <tr>
              <td style="padding: 0 0 12px 4px;">
                <div style="color: #f8fafc; font-size: 20px; font-weight: 800; font-family: Segoe UI, Arial, sans-serif;">MyFinance</div>
              </td>
            </tr>
            <tr>
              <td style="background: rgba(30, 41, 59, 0.92); border: 1px solid rgba(59, 130, 246, 0.28); border-top: 4px solid #3b82f6; border-radius: 16px; box-shadow: 0 14px 30px rgba(2, 6, 23, 0.35); padding: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding: 0 0 10px 0; color: #f8fafc; font-size: 22px; line-height: 1.3; font-weight: 800; font-family: Segoe UI, Arial, sans-serif;">
                      ${safeTitle}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 10px 0; color: #e2e8f0; font-size: 15px; line-height: 1.55; font-family: Segoe UI, Arial, sans-serif;">
                      ${safeGreeting}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 20px 0; color: #cbd5e1; font-size: 14px; line-height: 1.6; font-family: Segoe UI, Arial, sans-serif;">
                      ${safeBody}
                    </td>
                  </tr>
                  ${buttonBlock}
                  <tr>
                    <td style="padding: 0; color: #94a3b8; font-size: 13px; line-height: 1.55; font-family: Segoe UI, Arial, sans-serif;">
                      ${safeHelperText}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 6px 0 6px; color: #64748b; font-size: 12px; line-height: 1.5; font-family: Segoe UI, Arial, sans-serif; text-align: center;">
                ${safeFooterNote}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildVerificationEmail({ name, link }) {
  const safeName = String(name || "usuario").trim() || "usuario";
  return buildEmailLayout({
    preheader: "Confirme sua conta no MyFinance.",
    title: "Confirme seu cadastro",
    greeting: `Ola, ${safeName}!`,
    body: "Para ativar sua conta e manter seus dados protegidos, confirme seu cadastro.",
    actionLabel: "Confirmar conta",
    actionUrl: link,
    helperText: "Se voce nao criou uma conta no MyFinance, ignore esta mensagem.",
    footerNote: "MyFinance - Controle financeiro familiar.",
  });
}

function buildResetPasswordEmail({ name, link }) {
  const safeName = String(name || "usuario").trim() || "usuario";
  return buildEmailLayout({
    preheader: "Redefinicao de senha solicitada.",
    title: "Redefinir senha",
    greeting: `Ola, ${safeName}!`,
    body: "Recebemos um pedido para redefinir sua senha. O link abaixo expira em 30 minutos.",
    actionLabel: "Redefinir senha",
    actionUrl: link,
    helperText: "Se voce nao solicitou esta alteracao, ignore este e-mail.",
    footerNote: "MyFinance - Controle financeiro familiar.",
  });
}

module.exports = {
  buildVerificationEmail,
  buildResetPasswordEmail,
};
