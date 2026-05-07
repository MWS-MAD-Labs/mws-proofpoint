
cat > test-env.js << 'EOF'
require('dotenv').config();
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
EOF