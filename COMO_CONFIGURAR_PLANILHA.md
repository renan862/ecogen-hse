# Como Configurar a Planilha do Google Sheets

Este guia descreve como integrar as respostas do formulário e emissões de certificados do sistema de Integração HSE diretamente na sua planilha do Google Sheets.

---

## Passo 1: Acessar o Editor de Scripts na Planilha

1. Abra a sua planilha do Google Sheets pelo link:
   👉 [Planilha de Integração HSE](https://docs.google.com/spreadsheets/d/177uCFCOFdePVLPcjR_0-tsF9iqzESaU5-2J2dO0XzTk/edit)
2. No menu superior, clique em **Extensões** (Extensions) e depois em **Apps Script**.
3. Uma nova janela com o editor de código será aberta.

---

## Passo 2: Inserir o Código no Apps Script

Apague qualquer código existente no editor do Apps Script e cole o código abaixo:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Se a planilha estiver vazia, adiciona o cabeçalho
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Data/Hora de Conclusão",
        "Nome Completo",
        "CPF",
        "Empresa",
        "Contato Emergência",
        "Setor Responsável",
        "Tipo de Presença",
        "Código Verificação"
      ]);
      
      // Formatar cabeçalho em negrito
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
    }
    
    // Insere os dados enviados pelo formulário
    sheet.appendRow([
      data.dateTime,
      data.name,
      data.cpf,
      data.company,
      data.emergency,
      data.sector,
      data.reason,
      data.verificationCode
    ]);
    
    // Retorna resposta de sucesso
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type"
      });
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type"
      });
  }
}
```

Clique no ícone de disquete (**Salvar projeto**) na barra superior do editor.

---

## Passo 3: Implantar como Aplicativo Web (Web App)

Para disponibilizar um link seguro (endpoint) que a página web possa acessar, siga estes passos:

1. No canto superior direito da tela do Apps Script, clique no botão azul **Implantar** (Deploy) e selecione **Nova implantação** (New deployment).
2. Clique no ícone de engrenagem ao lado de "Selecionar tipo" e escolha **App da Web** (Web app).
3. Preencha as configurações da seguinte maneira:
   - **Descrição**: `Integração HSE`
   - **Executar como**: **Eu** (Seu e-mail) - *Isso é necessário para que o script tenha permissão de editar sua própria planilha.*
   - **Quem tem acesso**: **Qualquer pessoa** (Anyone) - *Permite que a página faça a requisição POST sem exigir login do Google por parte do visitante.*
4. Clique em **Implantar** (Deploy).
5. O Google solicitará que você autorize o acesso. Clique em **Autorizar acesso** (Authorize access), selecione sua conta Google e clique em **Avançado** -> **Acessar projeto sem nome (não seguro)** e conceda as permissões necessárias.
6. Uma vez concluído, a tela exibirá a seção "App da Web" com um link chamado **URL do app da Web**.
7. Clique em **Copiar** para salvar esse link na sua área de transferência.

---

## Passo 4: Atualizar o arquivo `app.js` no Projeto

1. Abra o arquivo [app.js](file:///g:/site-HSE/app.js) no seu editor de código.
2. Na linha 8, localize a constante `GOOGLE_SHEETS_WEBAPP_URL`:
   ```javascript
   const GOOGLE_SHEETS_WEBAPP_URL = "SUA_URL_DO_WEB_APP_AQUI";
   ```
3. Substitua `"SUA_URL_DO_WEB_APP_AQUI"` pela URL que você copiou no Apps Script (mantenha as aspas).
   Exemplo:
   ```javascript
   const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz...-2J2dO0XzTk/exec";
   ```
4. Salve o arquivo.

Pronto! Agora, sempre que um participante concluir a integração, assinar digitalmente e gerar o certificado, uma nova linha será adicionada automaticamente na planilha em tempo real.
