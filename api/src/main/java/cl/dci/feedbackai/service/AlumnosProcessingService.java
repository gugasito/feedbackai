package cl.dci.feedbackai.service;

import java.io.InputStream;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.openai.client.OpenAIClient;
import com.openai.models.ChatModel;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AlumnosProcessingService {

    private final OpenAIClient openAIClient;

    private static final String SYSTEM_PROMPT = """
                Eres un asistente especializado en generar informes académicos formales basados en evaluaciones por competencias a partir de planillas Excel. Tu función es producir resúmenes con enfoque pedagógico, técnico y evaluativo, manteniendo claridad conceptual y recomendaciones prácticas de mejora. No debes definir ni describir la competencia en cada resumen; céntrate directamente en el desempeño del estudiante.

            Tu salida debe ser estrictamente JSON válido, sin texto adicional, sin explicación y sin comentarios fuera del JSON. El JSON debe seguir exactamente este esquema:

            {
              "students": [
                {
                  "name": "string",
                  "matricula": "string",
                  "summary_fuentes_datos_segura": "string",
                  "summary_trabajo_en_equipo": "string",
                  "notes": "string"
                }
              ],
              "notes": "string"
            }

            Definiciones de campos:
            - "students": lista de estudiantes.
            - "name": nombre literal del estudiante según la hoja "Lista".
            - "matricula": matrícula literal de la hoja "Lista" (sin formato científico).
            - "summary_fuentes_datos_segura": retroalimentación formal sobre su desempeño en la competencia Fuentes de Datos Segura.
            - "summary_trabajo_en_equipo": retroalimentación formal sobre su desempeño en la competencia Trabajo en Equipo.
            - "notes": observaciones breves por estudiante (máx. 200 caracteres).
            - "notes" (a nivel raíz): observaciones generales (máx. 300 caracteres).

            Estilo de los resúmenes (muy importante):

            1. No debes incluir definiciones de competencias ni explicaciones introductorias. Comienza directamente evaluando el desempeño del estudiante.

            2. Los textos deben ser más amplios y profundos que en versiones anteriores, integrando:
               - análisis cuantitativo del desempeño (cuántos indicadores alcanzó con nota máxima y el total),
               - análisis cualitativo detallado,
               - recomendaciones prácticas, aplicables y concretas sobre qué puede realizar el estudiante para mejorar.

            3. Menciona los indicadores con puntaje < 4 usando su nombre literal, integrados de manera narrativa.

            4. Puntaje 0:
               - Si existe, aclara que corresponde a una ausencia crítica de evidencia e indica acciones concretas para resolverla (revisión técnica, documentación, análisis ético, mejora del flujo, etc.).

            5. Si NO existe ningún puntaje 0, incluye literalmente la frase:
               "No se registraron indicadores con puntaje 0, lo que demuestra cumplimiento general de los criterios mínimos establecidos."
               Debe aparecer integrada naturalmente.

            6. Las recomendaciones deben enfocarse en acciones prácticas: por ejemplo,
               - cómo mejorar la trazabilidad,
               - cómo organizar mejor el pipeline,
               - cómo fortalecer documentación de procesos,
               - cómo aplicar estrategias éticas,
               - cómo mejorar la coordinación técnica del equipo,
               - cómo enriquecer visualizaciones o reportes,
               - cómo mejorar la revisión entre pares,
               - cómo aplicar un ETL más robusto,
               - cómo planificar y dividir responsabilidades de manera más efectiva.

            7. En la competencia Trabajo en Equipo, no describas qué es esa competencia; céntrate en:
               - cómo su desempeño colaborativo influyó en el resultado técnico,
               - qué prácticas de coordinación mejorar,
               - cómo fortalecer la revisión conjunta y la construcción colaborativa del pipeline,
               - qué dinámicas de comunicación o planificación deberían desarrollarse.

            8. Cada competencia debe tener 1–2 párrafos formales, con lenguaje académico claro pero fluido, integrando:
               - síntesis cuantitativa del desempeño,
               - fortalezas técnicas,
               - brechas específicas,
               - y recomendaciones prácticas de mejora.

            9. No repitas textos idénticos entre estudiantes; ajusta el análisis según el patrón real de sus indicadores.

            Contenido mínimo en cada resumen:
            1. Número total de indicadores evaluados.
            2. Cantidad de indicadores con nota máxima.
            3. Indicadores específicos con puntaje < 4.
            4. Recomendaciones pedagógicas y prácticas.
            5. Tratamiento del caso de puntaje 0 (si aplica).

            Datos de entrada:
            - El usuario enviará el contenido del Excel como texto tabular.
            - Formato de entrada:

              Hoja: Lista
              <filas en TSV>

              Hoja: Ev. Fuentes de Datos Segura
              <filas en TSV>

              Hoja: Ev. Trabajo en Equipo
              <filas en TSV>

            Reglas sobre las hojas:
            - "Lista": columna A = Nombre, columna B = Matrícula.
            - "Ev. Fuentes de Datos Segura": encabezado en segunda fila; primera columna = Nombre; siguientes = indicadores (0–4).
            - "Ev. Trabajo en Equipo": igual estructura.
            - Emparejar nombres con trim y case-insensitive.
            - Si un estudiante no aparece en una hoja, el resumen de esa competencia debe ser "" y se debe señalar el problema en "notes".

            Instrucciones críticas de salida:
            - Devuelve solo un JSON válido siguiendo exactamente el esquema indicado.
            - No incluyas texto antes ni después del JSON.
            - No uses comentarios ni explicaciones adicionales.

                """;

    /**
     * Procesa el Excel subido y devuelve la respuesta JSON (como String)
     * tal cual la entrega la API de OpenAI.
     */
    public String processFile(MultipartFile file) throws Exception {
        // 1) Convertir el Excel a texto tabular (por hoja) para el modelo
        String excelText = buildModelInputFromExcel(file);

        String userMessage = """
                A continuación se entrega el contenido relevante del archivo Excel.

                Cada hoja está indicada por un encabezado "Hoja: <nombre>" seguido de filas en formato TSV
                (columnas separadas por TAB, una fila por línea).

                ------------- INICIO DATOS -------------
                %s
                ------------- FIN DATOS -------------
                """.formatted(excelText);

        // 2) Llamar a la API de OpenAI
        ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
                .model(ChatModel.GPT_4_1) // o el modelo que uses
                .addSystemMessage(SYSTEM_PROMPT)
                .addUserMessage(userMessage)
                .maxCompletionTokens(12000) // ajustar si es necesario
                .build();

        ChatCompletion completion = openAIClient.chat()
                .completions()
                .create(params);

        String json = completion.choices().get(0)
                .message()
                .content()
                .orElseThrow(() -> new IllegalStateException("La respuesta de OpenAI no tiene contenido"));

        // Aquí podrías validar el JSON si quisieras, pero de momento lo devolvemos tal
        // cual
        return json;
    }

    /**
     * Construye una representación en texto de las hojas relevantes del Excel:
     * - Hoja "Lista"
     * - Hoja "Ev. Fuentes de Datos Segura"
     * - Hoja "Ev. Trabajo en Equipo"
     *
     * Cada hoja se representa como:
     * Hoja: <nombre>
     * <TSV>
     */
    private String buildModelInputFromExcel(MultipartFile file) throws Exception {
        StringBuilder sb = new StringBuilder();

        try (InputStream in = file.getInputStream();
                Workbook workbook = new XSSFWorkbook(in)) {

            // Hoja Lista
            Sheet lista = workbook.getSheet("Lista");
            if (lista != null) {
                sb.append("Hoja: Lista\n");
                appendSheetAsTsv(lista, sb);
                sb.append("\n\n");
            }

            // Hoja Ev. Fuentes de Datos Segura
            Sheet fuentes = workbook.getSheet("Ev. Fuentes de Datos Segura");
            if (fuentes != null) {
                sb.append("Hoja: Ev. Fuentes de Datos Segura\n");
                appendSheetAsTsv(fuentes, sb);
                sb.append("\n\n");
            }

            // Hoja Ev. Trabajo en Equipo
            Sheet trabajo = workbook.getSheet("Ev. Trabajo en Equipo");
            if (trabajo != null) {
                sb.append("Hoja: Ev. Trabajo en Equipo\n");
                appendSheetAsTsv(trabajo, sb);
                sb.append("\n\n");
            }
        }

        return sb.toString();
    }

    /**
     * Convierte una hoja de Excel a TSV simple:
     * - columnas separadas por TAB
     * - filas separadas por salto de línea
     */
    private void appendSheetAsTsv(Sheet sheet, StringBuilder sb) {
        int firstRow = sheet.getFirstRowNum();
        int lastRow = sheet.getLastRowNum();

        for (int r = firstRow; r <= lastRow; r++) {
            Row row = sheet.getRow(r);
            if (row == null)
                continue;

            int lastCell = row.getLastCellNum();
            if (lastCell < 0)
                continue;

            boolean anyValue = false;
            StringBuilder rowBuilder = new StringBuilder();

            for (int c = 0; c < lastCell; c++) {
                Cell cell = row.getCell(c);
                String value = "";

                if (cell != null) {
                    cell.setCellType(CellType.STRING);
                    value = cell.getStringCellValue();
                    if (value != null) {
                        value = value.replace("\r", " ").replace("\n", " ");
                    } else {
                        value = "";
                    }
                }

                if (!value.isEmpty()) {
                    anyValue = true;
                }

                rowBuilder.append(value);

                if (c < lastCell - 1) {
                    rowBuilder.append("\t");
                }
            }

            if (anyValue) {
                sb.append(rowBuilder.toString()).append("\n");
            }
        }
    }
}
