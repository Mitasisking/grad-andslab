module.exports = {
  async redirects() {
    return [
      {
        // /batches was folded into /submit's own top-of-page batch panel.
        source: '/batches',
        destination: '/submit',
        permanent: true,
      },
    ]
  },
};
