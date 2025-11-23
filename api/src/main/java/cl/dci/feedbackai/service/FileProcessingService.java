package cl.dci.feedbackai.service;

import java.io.InputStream;

import org.apache.poi.ss.usermodel.*;
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
public class FileProcessingService {

    private final OpenAIClient openAIClient;

    private static final String SYSTEM_PROMPT = """
    Eres un asistente especializado en generar resúmenes académicos automatizados a partir de planillas Excel de evaluaciones.

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

    - "students": lista de estudiantes.
    - "name": nombre literal del estudiante según la hoja "Lista".
    - "matricula": matrícula literal de la hoja "Lista" (sin formato científico).
    - "summary_fuentes_datos_segura": resumen académico para la competencia Fuentes de Datos Segura.
    - "summary_trabajo_en_equipo": resumen académico para la competencia Trabajo en Equipo.
    - "notes": observaciones breves por estudiante (máx. 200 caracteres) sobre emparejamientos faltantes, supuestos o datos incompletos. Si no hay nada relevante, usar "".
    - "notes" (a nivel raíz): texto breve opcional (máx. 300 caracteres) con observaciones generales del procesamiento. Si no hay nada relevante, usar "".

    Formato y contenido de los resúmenes:
    - Genera dos resúmenes por estudiante: uno para "Fuentes de Datos Segura" y otro para "Trabajo en Equipo" en texto plano.
    - Incluye un párrafo específico para indicadores con puntaje 0 cuando existan; si no, incluye la frase exacta:
      "No se registraron indicadores con puntaje 0, lo que demuestra cumplimiento general de los criterios mínimos establecidos."
    - Cada resumen debe contener: (1) total de indicadores; (2) conteo de puntajes 4 / 3 / 2 / 0; (3) mención de indicadores con puntaje < 4 usando el nombre literal del indicador; (4) recomendaciones formales y un cierre institucional.

    Datos de entrada:
    - No recibirás una ruta de archivo. En su lugar, el mensaje de usuario te entregará el contenido relevante del Excel como texto tabular.
    - El mensaje de usuario contendrá bloques por hoja, con el formato:

      Hoja: Lista
      <filas en TSV: columnas separadas por TAB, una fila por línea>

      Hoja: Ev. Fuentes de Datos Segura
      <filas en TSV>

      Hoja: Ev. Trabajo en Equipo
      <filas en TSV>

    Reglas sobre las hojas:
    - Hoja "Lista": columna A = Nombre, columna B = Matrícula.
    - Hoja "Ev. Fuentes de Datos Segura": encabezado es la segunda fila (índice 1); primera columna = Nombre, columnas siguientes = indicadores numéricos (0–4).
    - Hoja "Ev. Trabajo en Equipo": mismo criterio que la anterior.
    - Puntajes esperados: números 0–4, tratar 0 como caso crítico.
    - Emparejar estudiantes por Nombre haciendo trim y case-insensitive.
    - Si un nombre de "Lista" no aparece en una hoja de evaluación, generar el resumen correspondiente como cadena vacía "" para esa competencia.

    Instrucciones críticas de salida:
    - Devuelve SOLO un JSON válido que siga exactamente el esquema indicado.
    - No incluyas texto antes ni después del JSON.
    - No uses comentarios, ni explicaciones, ni ejemplos adicionales.
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

        // Aquí podrías validar el JSON si quisieras, pero de momento lo devolvemos tal cual
        return json;
    }

    /**
     * Construye una representación en texto de las hojas relevantes del Excel:
     * - Hoja "Lista"
     * - Hoja "Ev. Fuentes de Datos Segura"
     * - Hoja "Ev. Trabajo en Equipo"
     *
     * Cada hoja se representa como:
     *   Hoja: <nombre>
     *   <TSV>
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
            if (row == null) continue;

            int lastCell = row.getLastCellNum();
            if (lastCell < 0) continue;

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
