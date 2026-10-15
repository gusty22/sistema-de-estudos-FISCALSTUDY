package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class MediaRoutingPrescriptionDTO {

    private String veiculo; // VIDEOAULA, PDF_LEITURA, CHAT_IA_DESBLOQUEIO
    private String titulo;
    private String prescricaoTexto;
    private String disciplina;
    private String assunto;
    private String categoriaDisciplina; // EXATAS_CALCULOS, LEIS_DECOREBA, GERAL_CONCEITUAL
    private String nivelFamiliaridade; // PRIMEIRO_CONTATO, EM_CONSOLIDACAO, DOMINADO
    private boolean bloqueioCognitivo;
    private int errosConsecutivos;
    private String velocidadeSugerida; // ex: "1.5x"
    private Integer blocoInicio; // ex: 1
    private Integer blocoFim; // ex: 3
    private Integer paginaSugerida; // ex: 20
    private String analogiaSugerida; // ex: "Dono de supermercado..."
    private String materialTitulo;

    public MediaRoutingPrescriptionDTO() {}

    public MediaRoutingPrescriptionDTO(String veiculo, String titulo, String prescricaoTexto,
                                        String disciplina, String assunto, String categoriaDisciplina,
                                        String nivelFamiliaridade, boolean bloqueioCognitivo, int errosConsecutivos) {
        this.veiculo = veiculo;
        this.titulo = titulo;
        this.prescricaoTexto = prescricaoTexto;
        this.disciplina = disciplina;
        this.assunto = assunto;
        this.categoriaDisciplina = categoriaDisciplina;
        this.nivelFamiliaridade = nivelFamiliaridade;
        this.bloqueioCognitivo = bloqueioCognitivo;
        this.errosConsecutivos = errosConsecutivos;
    }

    public String getVeiculo() { return veiculo; }
    public void setVeiculo(String veiculo) { this.veiculo = veiculo; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getPrescricaoTexto() { return prescricaoTexto; }
    public void setPrescricaoTexto(String prescricaoTexto) { this.prescricaoTexto = prescricaoTexto; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getAssunto() { return assunto; }
    public void setAssunto(String assunto) { this.assunto = assunto; }

    public String getCategoriaDisciplina() { return categoriaDisciplina; }
    public void setCategoriaDisciplina(String categoriaDisciplina) { this.categoriaDisciplina = categoriaDisciplina; }

    public String getNivelFamiliaridade() { return nivelFamiliaridade; }
    public void setNivelFamiliaridade(String nivelFamiliaridade) { this.nivelFamiliaridade = nivelFamiliaridade; }

    public boolean isBloqueioCognitivo() { return bloqueioCognitivo; }
    public void setBloqueioCognitivo(boolean bloqueioCognitivo) { this.bloqueioCognitivo = bloqueioCognitivo; }

    public int getErrosConsecutivos() { return errosConsecutivos; }
    public void setErrosConsecutivos(int errosConsecutivos) { this.errosConsecutivos = errosConsecutivos; }

    public String getVelocidadeSugerida() { return velocidadeSugerida; }
    public void setVelocidadeSugerida(String velocidadeSugerida) { this.velocidadeSugerida = velocidadeSugerida; }

    public Integer getBlocoInicio() { return blocoInicio; }
    public void setBlocoInicio(Integer blocoInicio) { this.blocoInicio = blocoInicio; }

    public Integer getBlocoFim() { return blocoFim; }
    public void setBlocoFim(Integer blocoFim) { this.blocoFim = blocoFim; }

    public Integer getPaginaSugerida() { return paginaSugerida; }
    public void setPaginaSugerida(Integer paginaSugerida) { this.paginaSugerida = paginaSugerida; }

    public String getAnalogiaSugerida() { return analogiaSugerida; }
    public void setAnalogiaSugerida(String analogiaSugerida) { this.analogiaSugerida = analogiaSugerida; }

    public String getMaterialTitulo() { return materialTitulo; }
    public void setMaterialTitulo(String materialTitulo) { this.materialTitulo = materialTitulo; }
}
