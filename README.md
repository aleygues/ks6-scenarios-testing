# Scenarios testing with Keystone6

This package is thought to be used with [Keystonejs v6 framework](https://keystonejs.com/).

The idea behind this package is to provide an efficient way to execute **integration** and **end to end** tests against a Keystone app. The idea is mainly inspired by Postman runner approach with prerequest scripts and tests suit. 

## Motivations

Even if Postman is great, you have to pay to share and work as a team on a tests collection. That's why I needed a way to work, share and create versions (versioning) of my tests (for free). With KS6 being released, the provided testing suit is now powerful enough to replace my Postman collections approach!

## Important note

Please note that this package mainly use [KS6 testing tools](https://keystonejs.com/docs/guides/testing) under the hood, so most of your problems may be answered in the doc! If you are still struggling, feel free to open an issue or contact me on the KS6 slack (aleygues).

## Installation

Just add the package using `yarn add -D ks6-scenarios-testing` or `npm i -D ks6-scenarios-testing`.

If you want to work with Typescript test files (I recommend this since KS6 is designed to be used with TS), you should create/update a `babel.config.js` in your root folder containing:

```
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
    ],
};
```

This configuration will let you use TS in your `.test.ts` files. You may also need to install dev dependencies: `yarn add -D @babel/preset-env @babel/preset-typescript @types/jest` (or with npm).

Finally, just add a `test` script in your `package.json` file: `jest --runInBand --testTimeout=60000`.

## Usage

Just create a scenario file `test/users.test.ts` for instance, import the lib, create your Gql requests and your scenrio:

```typescript
// test/users.test.ts
import { Lists } from ".keystone/types";
import { config } from '../../keystone';
import { query, run, custom } from 'ks6-scenarios-testing';
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
// Steps will be executed one after another!
run("Regular user story", config, [
    // Running a Gql mutation to create an User
    query<Lists.User.Item>("Create Toto", {
        query: createUser,
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
        testReponse: ({ json, variables }) => {
            expect(!!json.id).toBe(true);
            expect(json.email).toEqual(variables.email1);

            return {
                userId: json.id,
                session: {
                    itemId: json.id,
                    data: json
                }
            };
        }
    }),

    // Checking if the db contains the newly created user
    custom('Retrieve Toto in the db', async ({ context, variables }) => {
        const user = await context.sudo().db.User.findOne({
            where: {
                id: variables.userId
            }
        });

        expect(user).not.toBeFalsy();
    }),

    // Checking that an unauthenticated user cannot get Toto
    query<Lists.User.Item>("Get Toto from an authenticated User", {
        query: getUser,
        payload: variables => ({
            id: variables.userId
        }),
        // My user accesses does not throw a Gql error in that case, but user is null
        testFalsy: ({ json }) => {
            expect(json).toBeFalsy();
        }
    }),

    // Checking that an authenticated user (Toto) can query the User (himself)
    query<Lists.User.Item>("Get Toto from an authenticated User", {
        withAuth: true,
        query: getUser,
        payload: variables => ({
            id: variables.userId
        }),
        testReponse: ({ json, variables }) => {
            expect(json.id).toEqual(variables.userId);
        }
    }),
]);
```

You can run this example using `yarn test`.

If you are using a simple User model such as mine, you'll get something like:

```bash
PASS  test/scenarios/users.test.ts (7.571 s)
    Regular user story
        ✓ Create Toto (143 ms)
        ✓ Retrieve Toto in the db (16 ms)
        ✓ Get Toto from an authenticated User (8 ms)
        ✓ Get Toto from an authenticated User (14 ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        7.628 s, estimated 8 s
Ran all test suites.
Done in 8.55s.
```

Enjoy!