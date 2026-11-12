FROM node:24-slim
WORKDIR /app
COPY --chown=node:node dispatch.mjs ./dispatch.mjs
USER node
ENV WRITEWISE_EMAIL_SCHEDULER_ENABLED=false WRITEWISE_ALLOW_LOCALHOST=false
CMD ["node", "dispatch.mjs"]
