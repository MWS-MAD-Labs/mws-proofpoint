
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { queryOne } from '../src/lib/db';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

function maskUrl(url: string | undefined) {
    if (!url) return 'undefined';
    try {
        const u = new URL(url);
        u.password = '***';
        return u.toString();
    } catch {
        return 'invalid-url';
    }
}


interface DbUser {
    id: string;
    email: string;
    password_hash: string;
}

async function testAuth() {
    console.log('Testing authentication...');
    const email = 'faisal@millennia21.id';
    const passwordsToTest = ['password', 'Admin123', 'admin', '123456', 'Faisal123'];

    try {
        // 1. Check DB Connection
        console.log('1. Checking DB connection...');
        console.log('DB URL:', maskUrl(process.env.DATABASE_URL));
        const user = await queryOne<DbUser>(
            "SELECT id, email, password_hash FROM users WHERE email = $1",
            [email]
        );

        if (!user) {
            console.error(`User not found: ${email}`);
            return;
        }
        console.log('User found:', { id: user.id, email: user.email, hashExists: !!user.password_hash });

        // 2. Test Password Verification
        console.log('2. Testing password verification...');
        for (const password of passwordsToTest) {
            const isValid = await bcrypt.compare(password, user.password_hash);
            console.log(`Testing password '${password}': ${isValid ? 'MATCH' : 'INVALID'}`);
            if (isValid) {
                console.log(`SUCCESS! Valid password is: ${password}`);
                return;
            }
        }

        console.log('No matching password found in the test list.');

        // 3. Generate a new hash for testing if needed
        const testPass = 'password';
        const newHash = await bcrypt.hash(testPass, 10);
        console.log(`\nNew hash for 'password': ${newHash}`);
        const verifyNew = await bcrypt.compare(testPass, newHash);
        console.log(`Verify new hash: ${verifyNew}`);

    } catch (error) {
        console.error('Error during auth test:', error);
    }
}

testAuth();
