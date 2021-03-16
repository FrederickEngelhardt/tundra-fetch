import 'url';
import fetchMock from 'fetch-mock';
import omit from 'lodash.omit';
import buildRequestId from './requestIdBuilder';
import stringIsSimilarTo from './stringSimilarity';
import buildFetchMockConfig from './fetchMockConfigBuilder';
import buildRequestRepeatMap from './requestRepeatMapBuilder';
import removeURLPrefix from './removeURLPrefix';
import extractFetchArguments from './fetchArgumentExtractor';
import buildRequest from './requestBuilder';
import submitRequestData from './submitRequest';

const DEFAULT_CONFIG = {
  debuggingEnabled: true,
  debugPort: 9091,
};

const buildResponseOptions = response => ({
  body: response.content,
  headers: response.headers,
  status: response.statusCode,
});

export const matchingFunction = (matchingConfig, request, response) => (_url, _config) => {
  const { url, config } = extractFetchArguments([_url, _config]);
  const {
    urlMatcher, headersMatcher, methodMatcher, bodyMatcher, headersToOmit,
  } = matchingConfig || {};

  const configHeaders = JSON.stringify(omit(config.headers, headersToOmit));
  const requestHeaders = JSON.stringify(omit(request.headers, headersToOmit));

  let urlMatches = true;
  const defaultUrlMatcher = () => stringIsSimilarTo(removeURLPrefix(request.url), removeURLPrefix(url));

  if (urlMatcher) {
    urlMatches = urlMatcher(removeURLPrefix(request.url), removeURLPrefix(url), defaultUrlMatcher);
  } else {
    urlMatches = stringIsSimilarTo(removeURLPrefix(request.url), removeURLPrefix(url));
  }

  let bodyMatches = true;
  const defaultBodyMatcher = () => stringIsSimilarTo(request.content, config.body);

  if (bodyMatcher && config) {
    bodyMatches = bodyMatcher(request.content, config.body, defaultBodyMatcher);
  } else if (config) {
    bodyMatches = defaultBodyMatcher();
  }

  let headersMatch = true;
  const defaultHeadersMatcher = () => stringIsSimilarTo(requestHeaders, configHeaders);

  if (headersMatcher && config) {
    headersMatch = headersMatcher(requestHeaders, configHeaders, defaultHeadersMatcher);
  } else if (config) {
    headersMatch = defaultHeadersMatcher();
  }

  let methodMatches = true;
  const defaultMethodMatcher = () => config.method === request.method;

  if (methodMatcher && config) {
    methodMatches = methodMatcher(config.method, request.method, defaultMethodMatcher);
  } else if (config) {
    methodMatches = defaultMethodMatcher();
  }

  const everythingMatches = urlMatches && methodMatches && bodyMatches && headersMatch;

  if (everythingMatches && matchingConfig && matchingConfig.debuggingEnabled) {
    const responseOptions = buildResponseOptions(response);
    const builtRequest = buildRequest(url, config, responseOptions, responseOptions.body);

    submitRequestData(builtRequest, matchingConfig.debugPort, everythingMatches);
  }

  return everythingMatches;
};

export default (profileRequests, config) => {
  fetchMock.reset();

  const defaultedConfig = { ...DEFAULT_CONFIG, ...config };
  const repeatMap = buildRequestRepeatMap(profileRequests);

  profileRequests.forEach(({ request, response }) => {
    const requestRepeatMap = repeatMap[buildRequestId(request)];
    requestRepeatMap.invocations += 1;

    const responseOptions = buildResponseOptions(response);

    fetchMock
      .mock(
        matchingFunction(defaultedConfig, request, response),
        buildResponseOptions(response),
        buildFetchMockConfig(request, defaultedConfig, repeatMap),
      )
      .catch(async (...args) => {
        if (defaultedConfig.debuggingEnabled) {
          const { url, config: fetchConfig } = extractFetchArguments(args);
          const builtRequest = buildRequest(url, fetchConfig, responseOptions, responseOptions.body);

          await submitRequestData(builtRequest, defaultedConfig.debugPort, false);
        }

        console.error('Unable to match request');
      });
  });
};
