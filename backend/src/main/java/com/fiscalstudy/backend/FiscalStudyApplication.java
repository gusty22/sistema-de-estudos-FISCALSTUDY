package com.fiscalstudy.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@SpringBootApplication
@RestController
public class FiscalStudyApplication {
	public static void main(String[] args) {
		SpringApplication.run(FiscalStudyApplication.class, args);
	}

	@GetMapping("/")
	public Map<String, Object> rootStatus() {
		return Map.of(
			"status", "UP",
			"application", "FiscalStudy Backend API",
			"message", "O backend está operacional! Para acessar a interface visual do sistema, abra: http://localhost:5173",
			"frontend_url", "http://localhost:5173",
			"available_endpoints", List.of(
				"/api/v1/questions/disciplines",
				"/api/v1/questions/next",
				"/api/v1/ingestion/demo?cargo=532",
				"/api/v1/analytics/overview"
			)
		);
	}
}
