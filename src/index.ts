import { setupTestEnv, TestArgs, TestEnv } from '@keystone-6/core/testing';
import { KeystoneConfig, KeystoneContext } from '@keystone-6/core/types';

type IVariables = {
    [key: string]: unknown,
    /**
     * Set the session object that will be used in the subsequent request if they use withAuth param
     */
    session?: { itemId: string, data: any }
};

const variables: IVariables = {};

type GraphQLResponse<T> = {
    /**
     * GraphQL response data
     */
    data?: unknown,
    /**
     * GraphQL response errors
     */
    errors?: unknown,
    /**
     * If presente, the first subobject found in `data`. If `data = { user: { ... } }` then `json` will equal `{ ... }`
     */
    json?: T,
    /**
     * Variable of the scenario
     */
    variables: IVariables,
    /**
     * KS context that could be use to exec some other request or call the db
     */
    context: KeystoneContext
};
type GraphQLResponseWithJson<T> = GraphQLResponse<T> & { json: T };

export interface IQueryTest<T extends any> {
    /**
     * This is the first step executed before generating the query payload. This step should be used to create variables that will be stored and reuse in payload/testReponse
     */
    beforeRequest?: IVariables | (({ variables, context }: { context: KeystoneContext, variables: IVariables }) => (IVariables | Promise<IVariables>));
    /**
     * This is the very first step before the request, to generate the payload of the request (params). By using a function, you can use variables to generate the payload
     */
    payload?: IVariables | ((variables: IVariables) => (IVariables | Promise<IVariables>));
    /**
     * Just give a valid GraphQL query created using gql
     */
    query: string;
    /**
     * Test the query response. If testError and testFalsy are not used, then this function will be called only if the query didn't generate any error or falsy value
     */
    testReponse?: (response: GraphQLResponseWithJson<T>) => (IVariables | Promise<IVariables> | void);
    /**
     * Use this callback if you want to test the errors. Otherwise, the test will fail if errors are present in the result
     */
    testError?: (response: GraphQLResponse<T>) => (IVariables | Promise<IVariables> | void);
    /**
     * Use this callback if you want to test the falsy data (like { user: null }). Otherwise, the test will fail if a falsy data is returned
     */
    testFalsy?: (response: GraphQLResponse<T>) => (IVariables | Promise<IVariables> | void);
    /**
     * Set to true (default is false) if you want to set the `variables.session` object a the session for the request
     */
    withAuth?: boolean;
};

interface INamedQueryTest<T extends any> extends IQueryTest<T> {
    name: string;
}

interface INamedCustomTest {
    name: string;
    test: (testTools: TestArgs) => IVariables;
}

export const query = <T extends any>(testDescription: string, testCase: IQueryTest<T>): INamedQueryTest<T> => {
    return { ...testCase, name: testDescription };
};

export const custom = (testDescription: string, test: (testTools: TestArgs) => IVariables): INamedCustomTest => {
    return { test, name: testDescription };
};

type Test = INamedQueryTest<any> | INamedCustomTest;

export const run = (description: string, config: KeystoneConfig, tests: Test[]): void => {
    describe(description, () => {
        let testEnv: TestEnv;
        let context: KeystoneContext;

        beforeAll(async () => {
            testEnv = await setupTestEnv({ config });
            context = testEnv.testArgs.context;
            await testEnv.connect();
        });

        afterAll(async () => {
            await testEnv.disconnect();
        });

        for (const testToExec of tests) {
            test(testToExec.name, async () => {
                if ('test' in testToExec) {
                    const varUpdate = await testToExec.test(testEnv.testArgs);

                    if (varUpdate) {
                        Object.assign(variables, varUpdate);
                    }
                } else {
                    const varUpdate = typeof testToExec.beforeRequest === 'function' ?
                        await testToExec.beforeRequest({ variables, context })
                        : testToExec.beforeRequest;

                    if (varUpdate) {
                        Object.assign(variables, varUpdate);
                    }

                    let payload: IVariables = {};
                    if (testToExec.payload) {
                        if (typeof testToExec.payload === 'function') {
                            payload = await testToExec.payload(variables);
                        } else {
                            payload = testToExec.payload;
                        }
                    }

                    const result = await context
                        .withSession(testToExec.withAuth && variables.session || null)
                        .graphql.raw({
                            query: testToExec.query,
                            variables: payload
                        });

                    const json = result.data ? result.data[Object.keys(result.data || {})[0]] : null;

                    if (!testToExec.testError) {
                        if (result.errors) {
                            console.error(JSON.stringify(result.errors, null, 4));
                        }
                        expect(!result.errors).toBe(true);
                    } else if (result.errors) {
                        const varUpdate = await testToExec.testError({ ...result, context, json, variables });

                        if (varUpdate) {
                            Object.assign(variables, varUpdate);
                        }
                    }

                    if (!testToExec.testFalsy) {
                        expect(json).not.toBeFalsy();
                    } else if (result.errors) {
                        const varUpdate = await testToExec.testFalsy({ ...result, context, json, variables });

                        if (varUpdate) {
                            Object.assign(variables, varUpdate);
                        }
                    }

                    if (testToExec.testReponse) {
                        const varUpdate = await testToExec.testReponse({ ...result, context, json, variables });

                        if (varUpdate) {
                            Object.assign(variables, varUpdate);
                        }
                    }
                }
            });
        }
    });
};