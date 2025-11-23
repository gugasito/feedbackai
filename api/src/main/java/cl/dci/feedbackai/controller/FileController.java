package cl.dci.feedbackai.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import cl.dci.feedbackai.service.FileProcessingService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileProcessingService fileProcessingService;

    @PostMapping("/process")
    public ResponseEntity<byte[]> processFile(@RequestParam("file") MultipartFile file) throws Exception {
        byte[] result = fileProcessingService.processFile(file);

        String outputFilename = "resultado_" + file.getOriginalFilename();
        return ResponseEntity
                .ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .contentType(MediaType.parseMediaType("text/csv")) // o application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, etc.
                .body(result);
    }
}
