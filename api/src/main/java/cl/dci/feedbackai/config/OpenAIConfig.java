package cl.dci.feedbackai.config;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenAIConfig {

    @Bean
    public OpenAIClient openAIClient() {
        // Lee OPENAI_API_KEY, OPENAI_ORG_ID, etc. desde el entorno
        return OpenAIOkHttpClient.fromEnv();
    }
}
