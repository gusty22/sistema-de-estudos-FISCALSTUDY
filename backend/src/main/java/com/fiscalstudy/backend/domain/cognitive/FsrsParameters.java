package com.fiscalstudy.backend.domain.cognitive;

import java.util.Arrays;

/**
 * Parâmetros padrão do algoritmo FSRS (v6).
 * Vetor w com 21 coeficientes matemáticos otimizados.
 */
public class FsrsParameters {

    public static final double RETRIEVABILITY_DECAY = -0.1542;
    public static final double RETRIEVABILITY_FACTOR = Math.round((Math.pow(0.9, 1.0 / RETRIEVABILITY_DECAY) - 1) * 1e8) / 1e8;
    public static final double DEFAULT_REQUEST_RETENTION = 0.90;
    public static final double REVIEW_RETENTION_THRESHOLD = 0.88; // R < 0.88 dispara revisão
    public static final double MAX_INTERVAL_DAYS = 36500.0;
    public static final double MIN_STABILITY = 0.001;

    // Coeficientes padrão do FSRS v6
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
                0.0912,  // w[18] short term offset
                0.0658,  // w[19] short term stability exponent
                0.1542   // w[20] decay
        }, DEFAULT_REQUEST_RETENTION, MAX_INTERVAL_DAYS);
    }

    public FsrsParameters(double[] w, double requestRetention, double maximumInterval) {
        if (w == null || w.length != 21) {
            throw new IllegalArgumentException("Vetor de pesos FSRS deve conter exatamente 21 coeficientes");
        }
        for (double weight : w) if (!Double.isFinite(weight)) throw new IllegalArgumentException("FSRS weights must be finite");
        if (!Double.isFinite(requestRetention) || requestRetention <= 0 || requestRetention >= 1 || !Double.isFinite(maximumInterval) || maximumInterval < 1) throw new IllegalArgumentException("Invalid FSRS retention/interval");
        if (w[20] != 0.1542) throw new IllegalArgumentException("This reference profile requires FSRS6 default decay 0.1542");
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
