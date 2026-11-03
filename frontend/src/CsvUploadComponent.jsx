// frontend/src/CsvUploadComponent.jsx
import React, { useState, useRef } from 'react';
import Papa from 'papaparse'; // Para parsear CSV no frontend
import './App.css'; // Para usar os estilos do modal

// Estilos básicos para o modal (você pode integrar isso ao seu App.css)
const modalStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: '30px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        position: 'relative',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid #eee',
        paddingBottom: '10px',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#555',
    },
    fileInputContainer: {
        marginBottom: '20px',
        padding: '15px',
        border: '2px dashed #ccc',
        borderRadius: '5px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: '#f9f9f9',
    },
    fileInput: {
        display: 'none',
    },
    previewTable: {
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '20px',
        marginBottom: '20px',
    },
    tableHeader: {
        backgroundColor: '#f2f2f2',
        border: '1px solid #ddd',
        padding: '8px',
        textAlign: 'left',
    },
    tableCell: {
        border: '1px solid #ddd',
        padding: '8px',
        textAlign: 'left',
    },
    buttonContainer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        marginTop: '20px',
    },
    button: {
        padding: '10px 20px',
        borderRadius: '5px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
    },
    cancelButton: {
        backgroundColor: '#f44336',
        color: 'white',
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
        color: 'white',
    },
    uploadButton: {
        backgroundColor: '#2196F3',
        color: 'white',
    },
    message: {
        marginTop: '15px',
        padding: '10px',
        borderRadius: '5px',
        fontWeight: 'bold',
    },
    errorMessage: {
        backgroundColor: '#ffe0e0',
        color: '#d32f2f',
        border: '1px solid #d32f2f',
    },
    successMessage: {
        backgroundColor: '#e0ffe0',
        color: '#388e3c',
        border: '1px solid #388e3c',
    },
    progressBarContainer: {
        width: '100%',
        backgroundColor: '#e0e0e0',
        borderRadius: '5px',
        marginTop: '15px',
        height: '20px',
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4CAF50',
        textAlign: 'center',
        color: 'white',
        lineHeight: '20px',
        transition: 'width 0.3s ease-in-out',
    },
    loadingSpinner: {
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        animation: 'spin 1s linear infinite',
        display: 'inline-block',
        verticalAlign: 'middle',
        marginLeft: '10px',
    },
    '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' },
    }
};

const CsvUploadComponent = ({ isOpen, onClose, onUploadSuccess, apiUrl, token }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    // No Windows o navegador costuma informar .csv como application/vnd.ms-excel,
    // então a checagem é pela extensão.
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      setSelectedFile(file);
      setMessage('');
      setError('');
      // Ler o arquivo para preview
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        preview: 5, // Mostrar apenas as primeiras 5 linhas para preview
        complete: (results) => {
          setPreviewData(results.data);
        },
        error: (err) => {
          setError('Erro ao ler o arquivo CSV para preview.');
          console.error('Erro PapaParse:', err);
        }
      });
    } else {
      setSelectedFile(null);
      setPreviewData([]);
      setError('Por favor, selecione um arquivo CSV válido.');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Por favor, selecione um arquivo CSV para fazer o upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('csvFile', selectedFile); // O nome 'csvFile' deve corresponder ao esperado pelo Multer no backend

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', apiUrl, true);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          setMessage(response.message || 'Upload realizado com sucesso!');
          onUploadSuccess(); // Chamar a função para atualizar os leads no App.jsx
          setTimeout(() => {
            handleClose();
          }, 20000); // Fechar modal após 20 segundos (tempo para ler o resumo)
        } else {
          let errorResponse = {};
          try {
            errorResponse = JSON.parse(xhr.responseText);
          } catch {
            // Resposta sem JSON: usa a mensagem padrão.
          }
          const detail = [errorResponse.error, errorResponse.details].filter(Boolean).join(': ');
          setError(detail || 'Erro ao fazer upload do arquivo.');
          console.error('Erro de upload:', errorResponse);
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        setError('Erro de rede ou servidor. Verifique sua conexão e o backend.');
        console.error('Erro de rede durante o upload.');
      };

      xhr.send(formData);

    } catch (err) {
      setUploading(false);
      setError('Erro inesperado ao iniciar o upload.');
      console.error('Erro inesperado:', err);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setUploadProgress(0);
    setUploading(false);
    setMessage('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Limpar o input de arquivo
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modalContent}>
        <div style={modalStyles.header}>
            <h2>Upload de Planilha CSV</h2>
            <button style={modalStyles.closeButton} onClick={handleClose} aria-label="Fechar">&times;</button>
        </div>

        
        

        {selectedFile && previewData.length > 0 ? (
          <div className="csv-preview">
            <h3>Pré-visualização (primeiras 5 linhas):</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {Object.keys(previewData[0]).map((key, index) => (
                      <th key={index}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Object.values(row).map((value, colIndex) => (
                        <td key={colIndex}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            ) : (
                <div style={modalStyles.fileInputContainer} onClick={() => document.getElementById('csvFileInput').click()}>
                    <input
                        id="csvFileInput"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        style={modalStyles.fileInput}
                    />
                    <p>Arraste e solte seu arquivo CSV aqui, ou clique para selecionar.</p>            
                        {selectedFile && <p>Arquivo selecionado: <strong>{selectedFile.name}</strong></p>}
                </div>
            )
        }

        {uploading && uploadProgress > 0 && (
          <div style={modalStyles.progressBarContainer}>
            <div style={{ ...modalStyles.progressBar, width: `${uploadProgress}%` }}>
              {uploadProgress}%
            </div>
          </div>
        )}

        {message && <p style={{ ...modalStyles.message, ...modalStyles.successMessage }}>{message}</p>}
        {error && <p style={{ ...modalStyles.message, ...modalStyles.errorMessage }}>{error}</p>}

        <div style={modalStyles.buttonContainer}>
          <button style={{ ...modalStyles.button, ...modalStyles.cancelButton }} onClick={handleClose} disabled={uploading}>
            Cancelar
          </button>
          <button style={{ ...modalStyles.button, ...modalStyles.confirmButton }} onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? 'Enviando...' : 'Confirmar Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CsvUploadComponent;