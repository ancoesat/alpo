using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace KBYTE.Auth;

public class ApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "ApiKey";
    private const string HeaderName = "X-Api-Key";
    private readonly IConfiguration _configuration;

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration configuration)
        : base(options, logger, encoder)
    {
        _configuration = configuration;   
    }
    
    
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var provideKey))
           return Task.FromResult(AuthenticateResult.Fail($"Missing {HeaderName} header."));
           
        var configuredKey = _configuration["ApiKey"];
        if (string.IsNullOrWhiteSpace(configuredKey))
           return Task.FromResult(AuthenticateResult.Fail("Server has no ApiKey configurated."));
           
        var providedBytes = Encoding.UTF8.GetBytes(provideKey.ToString());
        var configuredBytes = Encoding.UTF8.GetBytes(configuredKey);
        
        if (providedBytes.Length != configuredBytes.Length ||
             !CryptographicOperations.FixedTimeEquals(providedBytes, configuredBytes))
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid API key."));
        }      
        
        var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "kbyte-client" ) }, Scheme.Name);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
        
           
    }
        








    
}