import type { RichExperiment } from "./types";
import { C_RICH } from "./rich-c";
import { CPP_RICH, JAVA_RICH } from "./rich-cpp-java";
import { PY_RICH, DSA_RICH } from "./rich-python-dsa";
import { OS_RICH, CN_RICH, CRYPTO_RICH, AI_RICH, AIML_RICH, WEB_RICH, PROMPT_RICH, COMM_RICH, ANDROID_RICH } from "./rich-others";

export const RICH: Record<string, RichExperiment[]> = {
  "c-programming": C_RICH,
  "cpp-programming": CPP_RICH,
  "java-programming": JAVA_RICH,
  "python-programming": PY_RICH,
  dsa: DSA_RICH,
  "operating-systems": OS_RICH,
  "computer-networks": CN_RICH,
  "cryptography-network-security": CRYPTO_RICH,
  "artificial-intelligence": AI_RICH,
  "ai-ml-model-development": AIML_RICH,
  "web-technology": WEB_RICH,
  "prompt-engineering": PROMPT_RICH,
  "communication-skills": COMM_RICH,
  "android-development": ANDROID_RICH,
};
