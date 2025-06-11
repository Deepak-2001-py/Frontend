FROM public.ecr.aws/nginx/nginx:latest

LABEL maintainer="Lasantha" 

COPY /usr/share/nginx/html/Frontend

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
