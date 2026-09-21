const React = require("react");

const Icon = React.forwardRef(function MockLucideIcon(props, ref) {
  return React.createElement("MockLucideIcon", { ...props, ref });
});

module.exports = new Proxy(
  { __esModule: true, default: Icon },
  {
    get(target, property) {
      return property in target ? target[property] : Icon;
    },
  },
);
