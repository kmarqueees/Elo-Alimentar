[README.md](https://github.com/user-attachments/files/34929698/README.md)
<div align="center">

# 🥗 Elo Alimentar

**Conecta doadores de alimentos excedentes às instituições que mais precisam, com um ranking de compatibilidade que considera distância, validade e logística.**

![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Testes](https://img.shields.io/badge/testes-71%20passando-brightgreen)
![TCC](https://img.shields.io/badge/TCC-FAMETRO-1F4B3F)

</div>

---

## 📋 Sobre o projeto

Todo dia, comércios e produtores descartam alimentos ainda próprios para consumo, enquanto instituições (cozinhas comunitárias, abrigos, ONGs) têm dificuldade de saber **quem tem o quê, onde e por quanto tempo**. Escolher a instituição "mais próxima" costuma falhar: ela pode não ter refrigeração, estar cheia ou ser longe demais para o prazo de validade.

O **Elo Alimentar** resolve isso com um **matching multicritério**: cada lote cadastrado é ranqueado contra as instituições, descartando as inviáveis e ordenando as demais por uma pontuação de 0 a 100. É o **diferencial deste TCC**, e o projeto traz uma comparação direta com a estratégia ingênua de "só distância".

### ✨ Principais funcionalidades

- 🎯 **Matching multicritério** — proximidade (40%), urgência da validade (35%) e compatibilidade logística (25%), com regras eliminatórias (refrigeração, raio de 15 km, tempo de deslocamento menor que a validade restante).
- 📊 **Comparação das estratégias** — multicritério × somente distância, nos mesmos dados (aproveitamento, 1ª indicação viável, tentativas, tempo até a retirada).
- 🔁 **Reserva e reoferta** — uma reserva ativa por lote; se o doador recusa ou o prazo (30 min) vence, o lote volta ao ranking **sem aquela instituição** e a próxima é sugerida.
- 🗺️ **Mapa interativo** (Leaflet + OpenStreetMap) para marcar o local do lote e visualizar o ranking.
- ♿ **Acessibilidade** — alto contraste, ajuste de fonte e redução de animações.
- 👥 **Telas por perfil** (doador e instituição) com **login de demonstração**.

> ⚠️ **Estado atual:** o login é apenas de demonstração (sem senha). Cadastro e autenticação reais (JWT, validação da instituição pelo administrador) estão previstos para a próxima etapa. Os dados são sintéticos.

---

## 🎬 Demonstração

<div align="center">
  <img src="docs/screenshots/01-inicio.png" alt="Tela inicial" width="45%">
  <img src="docs/screenshots/02-login-doador.png" alt="Login de demonstração" width="45%">
  <img src="docs/screenshots/03-doador-meus-lotes.png" alt="Doador: meus lotes" width="45%">
  <img src="docs/screenshots/04-doador-cadastro.png" alt="Doador: cadastro de doação" width="45%">
  <img src="docs/screenshots/05-inst-lote-dispo.png" alt="Instituição: lotes disponiveis para solicitação" width="45%">
  <img src="docs/screenshots/06-inst-acompanhar.png" alt="Instituição: acompanha as solicitações" width="45%">
  <img src="docs/screenshots/08-inst-detalhes-lote.png" alt="Instituição: detalhes do lote" width="45%">
</div>


---

## 🛠️ Tecnologias utilizadas

### Front end (`elo-alimentar-web`)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)

### Back end (`elo-alimentar-matching-api`)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

### Ferramentas
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)

---

## 🚀 Começando

### 📦 Pré-requisitos

- [Node.js](https://nodejs.org/) 20 ou superior e npm
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) (somente para a versão com PostgreSQL)
- Internet (o mapa e os tiles vêm do OpenStreetMap)

### 💻 Instalação e execução — modo rápido (sem banco)

Já sobe com 5 instituições e 20 lotes de exemplo. Os dados somem ao reiniciar a API.

1. **Clone o repositório**
   ```bash
   git clone https://github.com/kmarqueees/Elo-Alimentar.git
   cd Elo-Alimentar
   ```

2. **Terminal 1 — API**
   ```bash
   cd elo-alimentar-matching-api
   npm install
   npm run dev:memory        # http://localhost:3333
   ```

3. **Terminal 2 — front end**
   ```bash
   cd elo-alimentar-web
   npm install
   npm run dev               # http://localhost:5173
   ```

4. **Acesse** http://localhost:5173

### 🐘 Com PostgreSQL (Docker)

```bash
cd elo-alimentar-matching-api
cp .env.example .env
npm install
npm run db:up                           # sobe o PostgreSQL
npx prisma migrate dev --name init      # cria as tabelas
npm run db:seed                         # 5 instituições, 20 lotes, doadores de exemplo
npm run dev                             # API em http://localhost:3333
```

Variáveis do `.env` (já preenchidas no `.env.example`):

```env
DATABASE_URL="postgresql://docker:docker@localhost:5432/elo_alimentar?schema=public"
TEST_DATABASE_URL="postgresql://docker:docker@localhost:5432/elo_alimentar_test?schema=public"
RESERVATION_TIMEOUT_MINUTES=30   # opcional: prazo do doador para aceitar
```

---

## 📖 Como usar (roteiro de demonstração)

1. Na **tela inicial**, escolha *Quero doar alimentos* (doador) ou *Sou uma instituição receptora* e clique em **Entrar** (login de demonstração).
2. **Doador → Cadastro de doação:** Hortifruti, 18 kg, validade em 2 h, *Refrigerado*; marque o local no mapa perto do **Banco de Alimentos Rio Negro** (≈ -3,1735 / -60,0216), que aceita hortifruti mas **não tem refrigeração**.
3. **Resultado do matching**, lado a lado:
   - *Somente distância:* a 1ª indicação é o Banco de Alimentos, marcada como **inviável: sem refrigeração**.
   - *Multicritério:* só aparecem as viáveis, com a decomposição em proximidade, urgência e compatibilidade.
4. **Reserva e reoferta:** como instituição, abra o lote e use *Solicitar este lote*. Como doador, *Recusar* (ou deixe o prazo vencer): o lote volta ao ranking sem aquela instituição. Depois *Aceitar solicitação* e *Registrar retirada*.
5. **Comparação:** as duas estratégias nos mesmos dados.

Para encurtar o prazo do doador na demonstração: `RESERVATION_TIMEOUT_MINUTES=1 npm run dev:memory`.

### Principais rotas da API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/batches` | Cadastra um lote |
| `GET` | `/batches?status=` | Lista lotes (`AVAILABLE`, `RESERVED`, `COLLECTED`, `EXPIRED`, `ALL`) |
| `GET` | `/batches/:id/matches?strategy=` | Ranking (`multicriteria` ou `distance`) |
| `POST` | `/batches/:id/reservations` | Instituição solicita o lote |
| `PATCH` | `/reservations/:id/confirm` · `reject` · `pickup` | Aceitar, recusar, registrar retirada |
| `GET` | `/comparison` | Compara as duas estratégias |
| `GET` · `POST` | `/institutions` | Lista e cadastra instituições |

Exemplos prontos em `elo-alimentar-matching-api/requests.http`.

---

## 🧠 Como funciona o matching

1. **Filtros eliminatórios:** refrigeração (para lotes refrigerados/congelados), raio máximo de 15 km e tempo de deslocamento menor que as horas restantes de validade.
2. **Pontuação** das instituições que passam:
   - **Proximidade** = 1 − distância / 15 km
   - **Urgência** = quanto da validade sobra após o deslocamento (velocidade média de 30 km/h)
   - **Compatibilidade** = 60% ajuste de capacidade + 40% tipo de alimento aceito
3. **Pesos:** 0,40 / 0,35 / 0,25. O peso da urgência diminui para lotes com muita validade e os pesos são renormalizados.

O núcleo está em `elo-alimentar-matching-api/src/matching/` (estratégias `MultiCriteriaStrategy` e `DistanceOnlyStrategy`, padrão *Strategy*).

---

## 🗂️ Estrutura de pastas

```
📦 elo-alimentar-tcc
├── 📁 elo-alimentar-matching-api/   # Back end (Fastify + Prisma)
│   ├── 📁 src/
│   │   ├── 📁 matching/             # Algoritmo e estratégias (núcleo do TCC)
│   │   ├── 📁 use-cases/            # Regras de negócio (um caso de uso por arquivo)
│   │   ├── 📁 repositories/         # Interfaces + implementações (memória e Prisma)
│   │   ├── 📁 http/                 # Rotas, erros e presenters
│   │   └── 📁 simulation/           # Cenário e simulação comparativa
│   ├── 📁 prisma/                   # Schema do banco
│   └── 📄 docker-compose.yml
├── 📁 elo-alimentar-web/            # Front end (React + Vite + Leaflet)
│   └── 📁 src/ (screens, components, api.ts, session.ts)
├── 📁 docs/screenshots/             # Imagens usadas neste README
└── 📄 README.md
```

Arquitetura: casos de uso dependem de **interfaces de repositório** (inversão de dependência), com a composição feita em um único ponto (`compose-use-cases.ts`).

---

## 🧪 Testes

```bash
cd elo-alimentar-matching-api
npm test               # 71 testes unitários, sem banco
npm run simulate       # simulação comparativa (20 lotes, 5 instituições, 500 repetições)
npm run db:test:prepare && npm run test:int   # integração com PostgreSQL
cd ../elo-alimentar-web
npm run build          # checa tipos e gera o build
```

Resultado da simulação (semente 42, 20 lotes): multicritério reservou 20/20 com 1ª indicação viável em 100% dos casos, contra 19/20 e 55% da estratégia só por distância; **redução de ~65% no tempo até a retirada**. Em 500 repetições, a redução média foi de ~48%.

---

## 🚧 Próximos passos

- [ ] Cadastro e login reais (senha com hash e JWT)
- [ ] Validação de instituições pelo administrador
- [ ] Notificações
- [ ] Conversão de endereço em coordenadas
- [ ] Teste de usabilidade (SUS)

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

## 👨‍💻 Autores
**Fernando Vinicíus e Kayson Marques**

— Trabalho de Conclusão de Curso, **FAMETRO**,
  curso **CURSO DE SISTEMA DE INFORMAÇÃO**, orientação de **LUANA LEAL**.

- GitHub: [@Nandoymelo](https://github.com/Nandoymelo)
- GitHub: [@kmarqueees](https://github.com/kmarqueees)
- LinkedIn: [Fernando Vinicius](https://www.linkedin.com/in/fernando-melo-diaas)
- LinkedIn: [Kayson Marques](https://www.linkedin.com/in/kaysonmarques)

---

## 🙏 Agradecimentos
- Agradecimento especial à professora e orientadora **LUANA LEAL**
- GitHub: https://github.com/ProfaLuanaLeal
- À FAMETRO e à orientação do trabalho

---

<div align="center">

**⭐ Se este projeto foi útil, considere dar uma estrela!**

</div>
