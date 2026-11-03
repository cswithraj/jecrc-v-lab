import { z } from "zod";
export const LanguageEnum = z.enum(["C", "CPP", "JAVA", "PYTHON", "JAVASCRIPT", "HTML", "CSS", "SQL", "SHELL", "NONE"]);
export const DifficultyEnum = z.enum(["EASY", "MEDIUM", "HARD"]);
export const EnvironmentEnum = z.enum(["CODE", "WEB", "SQL", "SHELL", "NETWORK", "DSA_VISUAL", "NOTEBOOK", "ANDROID", "WRITTEN"]);
