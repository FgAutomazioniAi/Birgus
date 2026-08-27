FROM vllm/vllm-openai:v0.10.2

COPY vllm/entrypoint.sh /usr/local/bin/birgus-vllm
RUN chmod +x /usr/local/bin/birgus-vllm

ENTRYPOINT ["/usr/local/bin/birgus-vllm"]
