# Divergências entre a implementação e o documento de requisitos

Lista viva dos pontos em que o Tamba, **de propósito**, faz diferente do que o
documento de requisitos descreve. Serve para corrigir o documento na entrega
final. Cada item tem o motivo em uma linha; o detalhe técnico está na
[ARQUITETURA.md](ARQUITETURA.md).

Ao mudar algo que se afaste do documento, acrescente uma linha aqui.

## Divergências

| Requisito | Implementação | Motivo |
| --- | --- | --- |
| RNF-08 — aplicativo móvel nativo | Aplicação web responsiva (React + Vite), sem app nativo | Um semestre, sem tempo para manter duas bases de código; a web cobre celular e computador |
| REQ-25, RNF-10 — modo offline | Não há modo offline: toda ação precisa de conexão | Sincronização offline (fila local, conflitos) não cabe no escopo do semestre |
| Área administrativa | Não há área de admin separada: as ações de admin (UC002, UC010, UC011) aparecem dentro das telas normais, só para admin | Menos telas para construir e testar, e o admin modera onde o conteúdo está |
| Banimento de usuário | Desativação simples (ativar/desativar), sem motivo, prazo nem histórico | Cobre o efeito necessário (a pessoa sai do app) sem um sistema de moderação completo |
| Armazenamento das fotos | Em disco local do servidor durante o desenvolvimento | Ninguém do grupo precisa de conta em serviço externo; produção exigiria armazenamento de objetos (S3, Cloudinary) |
| RGN-01 — conta só ativa após confirmar o e-mail | A confirmação existe, mas fica desligada por padrão (`REQUIRE_EMAIL_VERIFICATION`); o e-mail sai no terminal da API, sem SMTP | Tira o atrito do desenvolvimento; liga-se com uma variável para a demonstração |
| REQ-32 — "puxar para atualizar" | Botão "Atualizar" no topo do feed | É o equivalente na web; o gesto de puxar é próprio de app móvel |

## Interpretações

Pontos em que o documento admite mais de uma leitura e o projeto escolheu uma.

| Requisito | Leitura adotada | Motivo |
| --- | --- | --- |
| Unidade de medida (kg/lb) | "lb" vale como sistema imperial inteiro: libras **e polegadas** | Quem pesa em libras mede em polegadas; misturar libras com centímetros seria estranho |
| RGN-13 — localização exata | Protege só a coordenada; o nome do local digitado pelo autor continua visível | O nome é um rótulo que o autor escreveu de propósito no post (ver o comentário em `catch.service.js`) |
