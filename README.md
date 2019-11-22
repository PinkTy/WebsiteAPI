# Website repo

## Running locally

All you need to do to run your server locally is create a `.env` file in the root directory of this project including the following information:

```
HOST=your_host
MYSQL_USER={your username}
MYSQL_PASSWORD={your password}
MYSQL_DATABASE={your database}
```

1. Use `npm install` to populate the `node_modules/` directory with up-to-date packages.
2. Run `npm run start` or `npm run debug` to start the server.
3. The server will be accessible on `localhost:4941`.
