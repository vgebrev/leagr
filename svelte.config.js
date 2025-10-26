import adapter from '@sveltejs/adapter-node';

const config = {
    kit: {
        adapter: adapter({
            bodyParser: {
                sizeLimit: '6MB' // Allow up to 6MB for avatar uploads (max is 5MB in avatar manager)
            }
        }),
        alias: {
            $lib: 'src/lib',
            $components: 'src/components'
        },
        csrf: {
            trustedOrigins: ['*']
        }
    }
};

export default config;
