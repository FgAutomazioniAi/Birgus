FROM docker:27-cli

WORKDIR /app
COPY vllm_lifecycle/requirements.txt /tmp/requirements.txt
RUN apk add --no-cache python3 py3-pip docker-cli-compose \
  && pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt
COPY vllm_lifecycle/app ./app

EXPOSE 8203

CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8203"]
