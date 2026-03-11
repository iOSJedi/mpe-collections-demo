FROM public.ecr.aws/lambda/python:3.11

COPY requirements.txt .
RUN pip install --only-binary=:all: -r requirements.txt

COPY ml_pipeline/ ${LAMBDA_TASK_ROOT}/ml_pipeline/
COPY lambda_handler.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_handler.handler"]
