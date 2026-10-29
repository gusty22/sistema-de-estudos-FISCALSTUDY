package com.fiscalstudy.backend.architecture;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.junit.jupiter.api.Test;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/** Dependency directions; no application boot or database access. */
class DevelopmentArchitectureTest {
    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.fiscalstudy.backend");

    @Test void domainAvoidsOuterLayersExceptDocumentedLegacyDtoPair() {
        classes().that().resideInAPackage("..domain..")
                .should(new ArchCondition<JavaClass>("avoid outer layers except the legacy cycle/weights DTO pair") {
                    @Override public void check(JavaClass origin, ConditionEvents events) {
                        for (var dependency : origin.getDirectDependenciesFromSelf()) {
                            String target = dependency.getTargetClass().getName();
                            boolean outer = target.startsWith("com.fiscalstudy.backend.application.")
                                    || target.startsWith("com.fiscalstudy.backend.infrastructure.");
                            String legacyDto = "com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO";
                            boolean legacyPair = origin.getName().equals("com.fiscalstudy.backend.domain.cycle.RobinHoodCycleEngine")
                                    && (target.equals(legacyDto) || target.startsWith(legacyDto + "$"));
                            if (outer && !legacyPair)
                                events.add(SimpleConditionEvent.violated(dependency, dependency.getDescription()));
                        }
                    }
                }).check(CLASSES);
    }

    @Test void applicationDoesNotDependOnWebControllers() {
        noClasses().that().resideInAPackage("..application..")
                .should().dependOnClassesThat()
                .resideInAPackage("..infrastructure.in.web")
                .check(CLASSES);
    }
}
