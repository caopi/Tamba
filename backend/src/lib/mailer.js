// Envio de e-mail.
//
// Por enquanto só existe o driver de console: o e-mail é impresso no terminal
// da API, e quem está testando copia o link de lá. Não há credencial SMTP no
// repositório de propósito. Para enviar de verdade, basta escrever um driver
// com o mesmo `send({ to, subject, text })` (ex.: com nodemailer) e trocar a
// constante `driver` — o resto do código só conhece as funções exportadas.

const consoleDriver = {
  async send({ to, subject, text }) {
    console.log(`\n--- e-mail (driver de console) ---\npara: ${to}\nassunto: ${subject}\n\n${text}\n---------------------------------\n`);
  },
};

const driver = consoleDriver;

export async function sendVerificationEmail(to, link) {
  await driver.send({
    to,
    subject: "Confirme seu e-mail no Tamba",
    text: `Para ativar sua conta, abra o link abaixo:\n\n${link}\n\nO link vale por 24 horas.`,
  });
}
