package com.fiscalstudy.backend.support;

import com.fiscalstudy.backend.infrastructure.process.BoundedProcess;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/** Probe the actual command, including PATH. Strict CI must not silently skip R integration. */
public final class RscriptTestSupport {
    private RscriptTestSupport() {}
    public static boolean available(String executable) {
        boolean available;
        try {available=BoundedProcess.run(List.of(executable,"--version"),Path.of(".").toAbsolutePath(),Duration.ofSeconds(5),Map.of()).exitCode()==0;}
        catch(Exception e) {available=false;}
        if(!available && Boolean.getBoolean("fiscalstudy.tests.require-r"))
            throw new AssertionError("R runtime required by this test gate: "+executable);
        return available;
    }
}
