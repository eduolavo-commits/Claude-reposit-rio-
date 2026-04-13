document.getElementById('inject-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['styles.css']
    });

    document.getElementById('status').textContent = 'HUD ativado com sucesso!';
  } catch (err) {
    document.getElementById('status').textContent = 'Erro: ' + err.message;
    document.getElementById('status').style.color = '#e94560';
  }
});
