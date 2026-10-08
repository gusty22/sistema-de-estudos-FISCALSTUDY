import os
import json
from abc import ABC, abstractmethod

class PdfExtractor(ABC):
    """
    Abstração base para extração de dados estruturados a partir de PDFs de concursos.
    """
    @abstractmethod
    def extract(self, file_path: str, metadata: dict) -> dict:
        """
        Extrai o conteúdo do PDF e o converte para um dicionário estruturado.
        Deve aplicar as estratégias de Boundary-Stitching e retornar um formato
        que cumpra o contrato ImportPayloadDTO.
        """
        pass
