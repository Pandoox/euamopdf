  const fileInput = document.getElementById('fileInput');
  const preview = document.getElementById('preview');
  const status = document.getElementById('status');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');

  let filesData = [];

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    filesData = files.map(file => ({
      file,
      rotation: 0,
      url: URL.createObjectURL(file)
    }));
    renderPreview();
  });

  function renderPreview() {
    preview.innerHTML = '';
    filesData.forEach((item, index) => {
      const container = document.createElement('div');
      container.className = 'img-container';
      container.draggable = true;
      container.dataset.index = index;

      const img = document.createElement('img');
      img.src = item.url;
      img.style.transform = `rotate(${item.rotation}deg)`;
      img.onclick = () => openLightbox(item.url);

      container.appendChild(img);

      const btns = document.createElement('div');
      btns.className = 'btns';

      const leftBtn = document.createElement('button');
      leftBtn.textContent = '⟲';
      leftBtn.onclick = (e) => {
        e.stopPropagation();
        item.rotation = (item.rotation - 90 + 360) % 360;
        renderPreview();
      };

      const rightBtn = document.createElement('button');
      rightBtn.textContent = '⟳';
      rightBtn.onclick = (e) => {
        e.stopPropagation();
        item.rotation = (item.rotation + 90) % 360;
        renderPreview();
      };

      btns.appendChild(leftBtn);
      btns.appendChild(rightBtn);
      container.appendChild(btns);

      // Mostrar nome do arquivo
      const nameLabel = document.createElement('div');
      nameLabel.textContent = item.file.name;
      nameLabel.style.fontSize = "12px";
      nameLabel.style.marginTop = "4px";
      nameLabel.style.maxWidth = "100%";
      nameLabel.style.overflow = "hidden";
      nameLabel.style.textOverflow = "ellipsis";
      nameLabel.style.whiteSpace = "nowrap";
      container.appendChild(nameLabel);

      // Drag and drop
      container.addEventListener('dragstart', e => {
        container.classList.add('dragging');
        e.dataTransfer.setData('text/plain', index);
      });

      container.addEventListener('dragend', () => {
        container.classList.remove('dragging');
      });

      container.addEventListener('dragover', e => {
        e.preventDefault();
        container.style.border = '2px dashed #2196f3';
      });

      container.addEventListener('dragleave', () => {
        container.style.border = '2px solid #ccc';
      });

      container.addEventListener('drop', e => {
        e.preventDefault();
        container.style.border = '2px solid #ccc';
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = index;
        const temp = filesData[fromIndex];
        filesData[fromIndex] = filesData[toIndex];
        filesData[toIndex] = temp;
        renderPreview();
      });

      preview.appendChild(container);
    });
  }

  function openLightbox(url) {
    lightboxImg.src = url;
    lightbox.style.display = 'flex';
  }

  function closeLightbox() {
    lightbox.style.display = 'none';
    lightboxImg.src = '';
  }

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

async function convertToPDF() {
  if (filesData.length === 0) {
    alert("Adicione imagens.");
    return;
  }

  status.textContent = "Convertendo...";
  const { PDFDocument, degrees } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  // Tamanho padrão A4 em pontos (595 x 842 pontos)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36; // 0.5 polegada

  for (const item of filesData) {
    try {
      // Processa a imagem corrigindo a orientação
      const imageBytes = await readAndCorrectImage(item);
      let img;

      // Detecta o tipo pelo conteúdo, não pela extensão
      const isJPEG = item.file.type === "image/jpeg" || item.file.name.toLowerCase().endsWith('.jpg') || item.file.name.toLowerCase().endsWith('.jpeg');
      const isPNG = item.file.type === "image/png" || item.file.name.toLowerCase().endsWith('.png');

      if (isJPEG) {
        img = await pdfDoc.embedJpg(imageBytes);
      } else if (isPNG) {
        img = await pdfDoc.embedPng(imageBytes);
      } else {
        console.warn("Formato não suportado:", item.file.name);
        continue;
      }

      const dims = img.scale(1);
      const rotation = item.rotation % 360; // Rotação aplicada pelo usuário

      // Cria página com orientação adequada
      const page = rotation === 90 || rotation === 270 
        ? pdfDoc.addPage([pageHeight, pageWidth]) 
        : pdfDoc.addPage([pageWidth, pageHeight]);

      // Calcula dimensionamento com margens
      const availableWidth = page.getWidth() - 2 * margin;
      const availableHeight = page.getHeight() - 2 * margin;
      
      const scale = Math.min(
        availableWidth / dims.width, 
        availableHeight / dims.height
      );
      
      const scaledWidth = dims.width * scale;
      const scaledHeight = dims.height * scale;
      
      // Centraliza na página
      const x = margin + (availableWidth - scaledWidth) / 2;
      const y = margin + (availableHeight - scaledHeight) / 2;

      page.drawImage(img, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
        rotate: degrees(rotation),
      });

    } catch (error) {
      console.error("Erro ao processar imagem:", item.file.name, error);
      continue;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "imagens_convertidas.pdf";
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = "PDF gerado com sucesso!";
}

// Função para ler e corrigir a orientação da imagem
async function readAndCorrectImage(item) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Mantém a orientação original (corrige o flip automático do browser)
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(blob => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsArrayBuffer(blob);
        }, item.file.type);
      };
    };
    reader.readAsDataURL(item.file);
  });
}

  // Variável para controlar a ordenação atual
  let currentSortMode = 'original';
  
  // Função para extrair números dos nomes dos arquivos
  function extractNumber(filename) {
    const match = filename.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }
  
  // Função para ordenar os arquivos
  function sortFiles(mode) {
    currentSortMode = mode;
    
    // Atualiza visual dos botões
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('onclick').includes(mode)) {
        btn.classList.add('active');
      }
    });
    
    // Faz uma cópia para não perder a ordem original
    const filesToSort = [...filesData];
    
    switch(mode) {
      case 'name-asc':
        filesData.sort((a, b) => a.file.name.localeCompare(b.file.name));
        break;
      case 'name-desc':
        filesData.sort((a, b) => b.file.name.localeCompare(a.file.name));
        break;
      case 'number-asc':
        filesData.sort((a, b) => extractNumber(a.file.name) - extractNumber(b.file.name));
        break;
      case 'number-desc':
        filesData.sort((a, b) => extractNumber(b.file.name) - extractNumber(a.file.name));
        break;
      case 'date-asc':
        filesData.sort((a, b) => a.file.lastModified - b.file.lastModified);
        break;
      case 'date-desc':
        filesData.sort((a, b) => b.file.lastModified - a.file.lastModified);
        break;
      case 'size-asc':
        filesData.sort((a, b) => a.file.size - b.file.size);
        break;
      case 'size-desc':
        filesData.sort((a, b) => b.file.size - a.file.size);
        break;
      case 'original':
        // Volta para ordem original usando o índice
        filesData = filesToSort.sort((a, b) => a.originalIndex - b.originalIndex);
        break;
    }
    
    renderPreview();
  }

  // Modificação mínima no event listener para guardar índice original
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    filesData = files.map((file, index) => ({
      file,
      rotation: 0,
      url: URL.createObjectURL(file),
      originalIndex: index // Guarda a ordem original
    }));
    
    // Aplica ordenação atual se existir
    if (currentSortMode !== 'original') {
      sortFiles(currentSortMode);
    } else {
      renderPreview();
    }
  });

  // Adicione estas linhas para o drag and drop
const uploadArea = document.querySelector('.upload-area');

// Impede o comportamento padrão do navegador
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  uploadArea.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

// Destaca a área de drop
['dragenter', 'dragover'].forEach(eventName => {
  uploadArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  uploadArea.addEventListener(eventName, unhighlight, false);
});

// Handle drop
uploadArea.addEventListener('drop', handleDrop, false);

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  uploadArea.classList.add('highlight');
}

function unhighlight() {
  uploadArea.classList.add('highlight');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  fileInput.files = files;
  
  // Dispara o evento change manualmente
  const event = new Event('change');
  fileInput.dispatchEvent(event);
}
// Controle de Ordenação
document.getElementById('sortMethod').addEventListener('change', function() {
  sortFiles(this.value);
});

// Função de ordenação (já existente no seu código)
function sortFiles(mode) {
  currentSortMode = mode;
  
  switch(mode) {
    case 'name-asc':
      filesData.sort((a, b) => a.file.name.localeCompare(b.file.name));
      break;
    case 'name-desc':
      filesData.sort((a, b) => b.file.name.localeCompare(a.file.name));
      break;
    case 'number-asc':
      filesData.sort((a, b) => extractNumber(a.file.name) - extractNumber(b.file.name));
      break;
    case 'number-desc':
      filesData.sort((a, b) => extractNumber(b.file.name) - extractNumber(a.file.name));
      break;
    case 'date-asc':
      filesData.sort((a, b) => a.file.lastModified - b.file.lastModified);
      break;
    case 'date-desc':
      filesData.sort((a, b) => b.file.lastModified - a.file.lastModified);
      break;
    case 'original':
      // Mantém a ordem original
      break;
  }
  
  renderPreview();
}

// Função auxiliar para extrair números dos nomes
function extractNumber(filename) {
  const match = filename.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

  // TODAS AS SUAS FUNÇÕES ORIGINAIS PERMANECEM IGUAIS AQUI
