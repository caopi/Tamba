// Limite de requisições nas rotas que alguém de fora abusaria: testar senha
// no login sem parar, criar contas em massa e encher o volume de fotos.
// Ver DEPLOY.md, seção 7.
//
// Contagem em memória: vale porque a API roda numa instância só (o volume
// das fotos impede réplicas; DEPLOY.md, 1.1). Reiniciar a API zera as contas.
//
// A chave por IP depende do `trust proxy` do app.js estar certo: errado, ou
// todo mundo divide o mesmo limite (o IP do proxy), ou qualquer um troca de
// IP mandando um X-Forwarded-For inventado.

import { rateLimit } from "express-rate-limit";

function limite({ minutos, maximo, mensagem, ...opcoes }) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: maximo,
    // Cabeçalhos RateLimit-* padronizados, sem os X-RateLimit-* antigos.
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Mesmo formato de erro das outras rotas (errorHandler), para o
    // frontend mostrar a mensagem.
    handler: (req, res, _next, config) => {
      // O X-Forwarded-For cru vai para o log de propósito: é por ele que se
      // confere, depois do deploy, quantos proxies há na frente da API
      // (DEPLOY.md, seção 7).
      console.warn(
        `Limite de requisições: ${req.method} ${req.originalUrl} chave=${config.keyGenerator(req, res)} ` +
          `ip=${req.ip} x-forwarded-for=${req.headers["x-forwarded-for"] ?? "-"}`,
      );
      res.status(config.statusCode).json({ error: mensagem, code: "RATE_LIMITED" });
    },
    ...opcoes,
  });
}

// Só as tentativas que falham contam: quem divide o IP (a rede da faculdade,
// por exemplo) não gasta o limite entrando com a senha certa.
export const limiteLogin = limite({
  minutos: 15,
  maximo: 10,
  skipSuccessfulRequests: true,
  mensagem: "Muitas tentativas de login. Espere alguns minutos e tente de novo.",
});

// 20, não 5: numa apresentação, a turma inteira se cadastra da mesma rede,
// atrás de um IP só.
export const limiteCadastro = limite({
  minutos: 60,
  maximo: 20,
  mensagem: "Muitos cadastros feitos desta rede. Tente de novo mais tarde.",
});

export const limiteReenvio = limite({
  minutos: 60,
  maximo: 3,
  mensagem: "Muitos pedidos de reenvio. Tente de novo mais tarde.",
});

// Por usuário, não por IP: precisa vir depois do requireAuth. 30 por hora dá
// três capturas com 10 fotos cada.
export const limiteUpload = limite({
  minutos: 60,
  maximo: 30,
  keyGenerator: (req) => req.userId,
  mensagem: "Você enviou muitas fotos na última hora. Tente de novo mais tarde.",
});
