import 'url';
import fetchMock from 'fetch-mock';
import escapeRegExp from 'lodash.escaperegexp';

export function replayProfile(profileRequests) {

    fetchMock.reset();

    profileRequests.forEach(({request, response}) => {
        fetchMock.mock((url, opts) => {

            let actualOpts = opts ? opts : url;
            let actualUrl = opts ? url : url.url;

            let urlMatches = new RegExp(`^(https?://)?(www\\.)?${escapeRegExp(request.url)}$`, 'g').test(actualUrl);
            let bodyMatches = actualOpts ? actualOpts.body === request.content : true;
            let headersMatch = actualOpts ? JSON.stringify(actualOpts.headers) === JSON.stringify(request.headers) : true;
            let methodMatches = actualOpts ? actualOpts.method === request.method: true;

            return urlMatches && methodMatches && bodyMatches && headersMatch;
        }, {
            body: response.content,
            headers: response.headers,
            status: response.statusCode
        },{
            name: `${request.method} ${request.url}`,
            overwriteRoutes: false
        })
    });
}