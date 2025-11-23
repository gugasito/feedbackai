package cl.dci.feedbackai.service;

import java.nio.charset.StandardCharsets;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.openai.client.OpenAIClient;
import com.openai.models.ChatModel;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FileProcessingService {

    private final OpenAIClient openAIClient;

    // Aquí va tu prompt "privado" del backend
    private static final String SYSTEM_PROMPT = """
        Eres un asistente experto en evaluación académica.
        Recibirás el contenido de un archivo con datos de estudiantes y rúbricas.
        Debes generar un archivo de salida en formato CSV que contenga...
        (AQUÍ ESCRIBE TU PROMPT COMPLETO Y DETALLADO)
        """;

    public byte[] processFile(MultipartFile file) throws Exception {
        // Ojo: si es Excel necesitarás Apache POI u otra librería para leerlo.
        // Para simplificar, asumimos que el archivo es texto (CSV/TSV, etc.).
        String fileContent = new String(file.getBytes(), StandardCharsets.UTF_8);

        String userMessage = """
                Usa las instrucciones anteriores y este archivo de entrada:

                ------------- INICIO ARCHIVO -------------
                %s
                ------------- FIN ARCHIVO -------------
                """.formatted(fileContent);

        ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
                .model(ChatModel.GPT_4_1) // o el modelo que uses
                .addSystemMessage(SYSTEM_PROMPT)
                .addUserMessage(userMessage)
                .maxCompletionTokens(4000) // ajusta según tamaño
                .build();

        ChatCompletion completion = openAIClient.chat()
                .completions()
                .create(params);

        // ⚠ La estructura exacta puede variar según versión del SDK.
        // Revisa el Javadoc, pero típicamente obtendrás algo así:
        String outputText = completion.choices().get(0)
        .message()
        .content()
        .orElse("");

        // Aquí asumimos que el modelo devolvió directamente el CSV como texto.
        // Si quieres Excel, tendrías que crear un .xlsx con Apache POI a partir de este texto.
        return outputText.getBytes(StandardCharsets.UTF_8);
    }
}
