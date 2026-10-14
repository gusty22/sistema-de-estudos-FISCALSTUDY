package com.fiscalstudy.backend.domain.cognitive;

import java.util.Arrays;

/**
 * Parâmetros padrão do algoritmo FSRS (v5).
 * Vetor w com 19 coeficientes matemáticos otimizados.
 */
public class FsrsParameters {

    public static final double RETRIEVABILITY_DECAY = -0.5;
    public static final double RETRIEVABILITY_FACTOR = 19.0 / 81.0; // ~0.2345679
    public static final double DEFAULT_REQUEST_RETENTION = 0.90;
    public static final double REVIEW_RETENTION_THRESHOLD = 0.88; // R < 0.88 dispara revisão
    public static final double MAX_INTERVAL_DAYS = 36500.0;
    public static final double MIN_STABILITY = 0.1;

    // Coeficientes padrão do FSRS v5
    private final double[] w;
    private final double requestRetention;
    private final double maximumInterval;

    public FsrsParameters() {
        this(new double[]{
                0.212,   // w[0] S0(Again)
                1.2931,  // w[1] S0(Hard)
                2.3065,  // w[2] S0(Good)
                8.2956,  // w[3] S0(Easy)
                6.4133,  // w[4] D0(Good)
                0.8334,  // w[5] D0 multiplier
                3.0194,  // w[6] delta D multiplier
                0.001,   // w[7] mean reversion weight
                1.8722,  // w[8] recall stability multiplier
                0.1666,  // w[9] recall stability power S
                0.796,   // w[10] recall stability exp(1-R)
                1.4835,  // w[11] forget stability multiplier
                0.0614,  // w[12] forget stability power D
                0.2629,  // w[13] forget stability power S+1
                1.6483,  // w[14] forget stability exp(1-R)
                0.6014,  // w[15] hard penalty
                1.8729,  // w[16] easy bonus
                0.5425,  // w[17] short term factor
                0.0912   // w[18] short term offset
        }, DEFAULT_REQUEST_RETENTION, MAX_INTERVAL_DAYS);
    }

    public FsrsParameters(double[] w, double requestRetention, double maximumInterval) {
        if (w == null || w.length < 19) {
            throw new IllegalArgumentException("Vetor de pesos FSRS deve conter ao menos 19 coeficientes");
        }
        this.w = Arrays.copyOf(w, w.length);
        this.requestRetention = requestRetention;
        this.maximumInterval = maximumInterval;
    }

    public double getW(int index) {
        return w[index];
    }

    public double[] getW() {
        return Arrays.copyOf(w, w.length);
    }

    public double getRequestRetention() {
        return requestRetention;
    }

    public double getMaximumInterval() {
        return maximumInterval;
    }
}
