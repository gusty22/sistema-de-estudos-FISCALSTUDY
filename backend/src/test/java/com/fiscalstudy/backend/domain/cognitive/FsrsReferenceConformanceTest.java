package com.fiscalstudy.backend.domain.cognitive;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import static org.junit.jupiter.api.Assertions.*;
/** Constants captured by executing independent ts-fsrs reference core, not this Java implementation. */
class FsrsReferenceConformanceTest {
 private final FsrsEngine engine=new FsrsEngine();
 private final Instant start=Instant.parse("2026-01-01T00:00:00Z");
 @Test void officialInitialGood(){var s=engine.calculateNextState(null,FsrsRating.GOOD,start);assertEquals(2.11810397,s.getDifficulty(),1e-7);assertEquals(2.3065,s.getStability(),1e-7);}
 @Test void officialTenDayGood(){var s=engine.calculateNextState(FsrsCardState.of(10,5,1,0,start,start),FsrsRating.GOOD,start.plus(10,ChronoUnit.DAYS));assertEquals(4.99022837,s.getDifficulty(),1e-7);assertEquals(32.02672948,s.getStability(),1e-6);}
 @Test void officialTenDayAgain(){var s=engine.calculateNextState(FsrsCardState.of(10,5,1,0,start,start),FsrsRating.AGAIN,start.plus(10,ChronoUnit.DAYS));assertEquals(8.34176237,s.getDifficulty(),1e-7);assertEquals(1.39198697,s.getStability(),1e-6);}
 @Test void officialSameDayGood(){var s=engine.calculateNextState(FsrsCardState.of(10,5,1,0,start,start),FsrsRating.GOOD,start.plusSeconds(3600));assertEquals(4.99022837,s.getDifficulty(),1e-7);assertEquals(10,s.getStability(),1e-7);}
 @Test void invalidParametersAndBackdatedStateAreRejected(){assertThrows(IllegalArgumentException.class,()->new FsrsParameters(new double[19],.9,36500));assertThrows(IllegalArgumentException.class,()->engine.calculateNextState(FsrsCardState.of(10,5,1,0,start,start),FsrsRating.GOOD,start.minusSeconds(1)));}
}
