# Dex Screener Bot

## Description

This is a bot that will help you to find the best exchange to buy or sell your crypto.


## Steps to run this project:

1. Clone this repository
2. Duplicate `.env.example` to `.env`
3. Setup database settings inside `.env` file
4. Create your database ( manual ) or run `yarn db:create && yarn db:reset`
5. Run `yarn dev` command
6. Run watch command `yarn dev:watch`
7. Release your app for *Production* or *Staging* with `yarn release`
8. Build your code with Docker `docker build -t yourname/express:v1.0.0 .`
9. Run with docker image `docker run -p 7000:8000 -d yourname/express:v1.0.0`
