export default function catchErrors({ filename, components, imports }) {
  const [React, ErrorReporter, reporterOptions] = imports;

  if (!React || !React.Component) {
    throw new Error('imports[0] for react-transform-catch-errors does not look like React.');
  }
  if (typeof ErrorReporter !== 'function') {
    throw new Error('imports[1] for react-transform-catch-errors does not look like a React component.');
  }

  return function wrapToCatchErrors(ReactClass, componentId) {
    const originalRender = ReactClass.prototype.render;

    const lifecycleMethods = [
      'constructor',
      'componentWillMount',
      'componentDidMount',
      'componentWillReceiveProps',
      'shouldComponentUpdate',
      'componentWillUpdate',
      'componentDidUpdate',
      'componentWillUnmount'
    ];

    lifecycleMethods.forEach(method => {
      const originalMethod = ReactClass.prototype[method];
      if (!originalMethod) {
        return;
      }
      ReactClass.prototype[method] = function tryWrappedMethod() {
        try {
          return originalMethod.apply(this, arguments);
        } catch (err) {
          console.error('Error in method "' + method +
              '" of component "' + componentId + '"' +
              '" of class "' + (ReactClass.name || '') + '"' +
              ':' + err.toString(), err);
          this.__reactTransformCatchErrorsLastError = err;
          if (method === 'constructor') {
            return React.createClass({
              render: renderError.bind(this, err)
            });
          }
        }
      };
    });

    function renderError(err) {
      return React.createElement(ErrorReporter, {
        error: err,
        filename,
        ...reporterOptions
      });
    }

    ReactClass.prototype.render = function tryRender() {
      try {
        if (this.__reactTransformCatchErrorsLastError) {
          let err = this.__reactTransformCatchErrorsLastError;
          return renderError(err);
        }
        return originalRender.apply(this, arguments);
      } catch (err) {
        setTimeout(() => {
          if (typeof console.reportErrorsAsExceptions !== 'undefined') {
            let prevReportErrorAsExceptions = console.reportErrorsAsExceptions;
            // We're in React Native. Don't throw.
            // Stop react-native from triggering its own error handler
            console.reportErrorsAsExceptions = false;
            // Log an error
            console.error(err);
            // Reactivate it so other errors are still handled
            console.reportErrorsAsExceptions = prevReportErrorAsExceptions;
          } else {
            throw err;
          }
        });

        return renderError(err);
      }
    };

    return ReactClass;
  };
}
