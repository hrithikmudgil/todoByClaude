using Microsoft.AspNetCore.Identity;
using TodoApi.Domain;

namespace TodoApi.Features.Auth;

/// <summary>
/// Wraps the framework's <see cref="PasswordHasher{TUser}"/> (PBKDF2 with a per-hash random salt,
/// constant-time comparison). Only the hasher is used; there are no Identity stores or tables.
/// </summary>
public sealed class PasswordService
{
    private readonly PasswordHasher<User> _hasher = new();
    private readonly string _dummyHash;

    public PasswordService()
    {
        // Verified against when the account doesn't exist or is locked, so those paths cost the same
        // as a real check and response timing doesn't reveal which emails are registered.
        _dummyHash = _hasher.HashPassword(new User(), Guid.NewGuid().ToString("N"));
    }

    public string Hash(string password) => _hasher.HashPassword(new User(), password);

    /// <summary>Returns whether the password matches, plus an upgraded hash if the stored one is outdated.</summary>
    public (bool Verified, string? RehashedPassword) Verify(string storedHash, string password)
    {
        var result = _hasher.VerifyHashedPassword(new User(), storedHash, password);
        return result switch
        {
            PasswordVerificationResult.Success => (true, null),
            PasswordVerificationResult.SuccessRehashNeeded => (true, Hash(password)),
            _ => (false, null),
        };
    }

    /// <summary>Spends the same time as a real verification and discards the result.</summary>
    public void BurnTime(string password) => _hasher.VerifyHashedPassword(new User(), _dummyHash, password);
}
