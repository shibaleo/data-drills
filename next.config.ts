import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    const { DefinePlugin } = require("webpack");
    config.plugins.push(
      new DefinePlugin({
        __VUE_OPTIONS_API__: JSON.stringify(false),
        __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
      }),
    );
    return config;
  },
};

export default nextConfig;
