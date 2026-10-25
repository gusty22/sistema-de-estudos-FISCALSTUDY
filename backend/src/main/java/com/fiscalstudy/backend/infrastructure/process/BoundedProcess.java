package com.fiscalstudy.backend.infrastructure.process;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** File-backed combined output avoids pipe deadlock and bounds execution time. */
public final class BoundedProcess {
    private BoundedProcess() {}
    public record Result(int exitCode, String output) {}
    public static Result run(List<String> command, Path directory, Duration timeout, Map<String,String> env) throws IOException, InterruptedException {
        if(timeout.isNegative() || timeout.isZero()) throw new IllegalArgumentException("Positive timeout required");
        Path output=Files.createTempFile("fiscalstudy-process-", ".log");
        Process process=null;
        try {
            ProcessBuilder builder=new ProcessBuilder(command).directory(directory.toFile()).redirectErrorStream(true).redirectOutput(output.toFile());
            builder.environment().putAll(env);
            process=builder.start();
            if(!process.waitFor(timeout.toMillis(),TimeUnit.MILLISECONDS)) {
                process.descendants().forEach(ProcessHandle::destroyForcibly);process.destroyForcibly();process.waitFor(5,TimeUnit.SECONDS);
                throw new IOException("Subprocess exceeded timeout of "+timeout.toSeconds()+" seconds");
            }
            byte[] bytes;
            try(InputStream input=Files.newInputStream(output)){bytes=input.readNBytes(262144);}
            return new Result(process.exitValue(),new String(bytes,StandardCharsets.UTF_8));
        } finally {
            if(process!=null && process.isAlive()){process.descendants().forEach(ProcessHandle::destroyForcibly);process.destroyForcibly();}
            Files.deleteIfExists(output);
        }
    }
}
