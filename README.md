# Scenarios testing with Keystone6

This package is thought to be used with Keystonejs v6 framework.

The idea behind this package is to provide an efficient way to execute **integration** and **end to end** tests against a Keystone app. The idea is mainly inspired by Postman runner approach with prerequest script and tests suit. 

## Installation

Just add the package using `yarn add -D ks6-scenarios-testing` or `npm i -D ks6-scenarios-testing`.

If you want to work with Typescript test files (I recommend this since Keystone is designed to be used with TS), you should create/update a `babel.config.js` in your root folder containing:

```
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
    ],
};
```

Finally, just add a `test` script in your `package.json` file: `jest --runInBand --testTimeout=60000`.

## Usage

Just create a scenario file `test/users.test.ts` for instance, import the lib, create your Gql requests and your scenrio:

```typescript
// test/users.test.ts
import { Lists } from ".keystone/types";
import { config } from '../../keystone';
import { query, run } from 'ks6-scenarios-testing';
import { gql } from "@keystone-6/core";

// This Gql request could be moved to a graphql/users/createUser.ts file for instance
const createUser = gql`mutation createUser(
    $data: UserCreateInput!
) {
    createUser(data: $data) {
        id
        email
    }
}`;

// This Gql request could be moved to a graphql/users/getUser.ts file for instance
const getUser = gql`query user(
    $id: ID!
) {
    user(
        where: { id: $id }
    ) {
        id
        email
    }
}`;

// Creating a scenario
run("Regular user story", config, [
    query<Lists.User.Item>("Create Toto", {
        beforeRequest: {
            email1: "toto@gmail.com",
            password1: "supersecret"
        },
        payload: variables => ({
            data: {
                email: variables.email1,
                password: variables.password1
            }
        }),
        query: createUser,
        testReponse: ({ json, variables }) => {
            expect(!!json.id).toBe(true);
            expect(json.email).toEqual(variables.email1);

            return {
                session: {
                    itemId: json.id,
                    data: json
                }
            };
        }
    }),
    query<Lists.User.Item>("Get Toto using session", {
        withAuth: true,
        query: getUser,
        payload: variables => ({
            id: variables.session?.itemId
        }),
        testReponse: ({ json, variables }) => {
            expect(json.id).toEqual(variables.session?.itemId);
        }
    }),
]);
```