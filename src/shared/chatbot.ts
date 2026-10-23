/** Niveau 6 (IA) : « Le chatbot trop serviable » — assistant simulé, aucun appel à un LLM. */

/** Corps de `POST /api/chatbot-serviable/message`. */
export interface ChatRequest {
  message: string;
}

/** Réponse de Pixel, avec la règle du moteur qui l'a produite (affichée dans « les coulisses »). */
export interface ChatResponse {
  reply: string;
  /** Règle déclenchée, en clair (ex. « Injection : répéter le prompt »). */
  rule: string;
  /** Vrai si le filtre de sortie a bloqué la réponse (mode sécurisé). */
  blocked: boolean;
}
